import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { executeWorkflow } from '../services/executionEngine';
import { runEvents } from '../services/eventBus';

const createRunSchema = z.object({
  workflowId: z.string().uuid(),
  prompt: z.string().min(1).max(50000),
});

export async function createRun(req: Request, res: Response) {
  try {
    const body = createRunSchema.parse(req.body);

    const workflow = await prisma.workflow.findUnique({ where: { id: body.workflowId } });
    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    const run = await prisma.run.create({
      data: {
        workflowId: body.workflowId,
        prompt: body.prompt,
        triggeredBy: req.user!.userId,
        status: 'PENDING',
      },
    });

    req.log.info('Run created, starting execution', { runId: run.id, workflowId: body.workflowId });

    // Start execution asynchronously
    executeWorkflow(run.id, body.workflowId, body.prompt, req.user!.email).catch((err) => {
      req.log.error('Execution failed', { runId: run.id, error: (err as Error).message });
    });

    res.status(201).json(run);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
}

export async function getRun(req: Request, res: Response) {
  const run = await prisma.run.findUnique({
    where: { id: String(req.params.id) },
    include: {
      workflow: { select: { name: true } },
      steps: {
        include: { agent: { select: { name: true, family: true } } },
        orderBy: { startedAt: 'asc' },
      },
    },
  });
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  res.json(run);
}

export async function listRuns(req: Request, res: Response) {
  const { workflowId, status, page = '1', limit = '20' } = req.query;
  const where: Record<string, unknown> = {};
  if (workflowId) where.workflowId = workflowId;
  if (status) where.status = status;

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));

  const [runs, total] = await Promise.all([
    prisma.run.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: { workflow: { select: { name: true } } },
    }),
    prisma.run.count({ where }),
  ]);

  res.json({
    data: runs,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
}

export async function streamRun(req: Request, res: Response) {
  const runId = String(req.params.id);
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  // Send existing steps as initial state
  const existingSteps = await prisma.runStep.findMany({
    where: { runId: String(runId) },
    include: { agent: { select: { name: true } } },
  });
  res.write(`data: ${JSON.stringify({ type: 'init', steps: existingSteps, run })}\n\n`);

  // If run is already complete, close connection
  if (run.status === 'SUCCESS' || run.status === 'FAILED') {
    res.write(`data: ${JSON.stringify({ type: `run:${run.status.toLowerCase()}`, data: { status: run.status } })}\n\n`);
    res.end();
    return;
  }

  // Listen for events
  const listener = (event: { type: string; data: Record<string, unknown> }) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.type === 'run:complete' || event.type === 'run:error') {
      cleanup();
    }
  };

  const cleanup = () => {
    runEvents.removeListener(`run:${runId}`, listener);
    res.end();
  };

  runEvents.on(`run:${runId}`, listener);
  req.on('close', cleanup);
}
