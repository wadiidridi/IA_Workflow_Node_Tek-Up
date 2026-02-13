import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';

const nodeSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  label: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.unknown()).default({}),
  mappingIn: z.record(z.unknown()).default({}),
  mappingOut: z.record(z.unknown()).default({}),
  errorPolicy: z.enum(['STOP', 'CONTINUE']).default('STOP'),
  maxRetries: z.number().int().min(0).default(0),
  backoffMs: z.number().int().min(0).default(1000),
});

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

const workflowSchema = z.object({
  name: z.string().min(1).max(200),
  nodes: z.array(nodeSchema).default([]),
  edges: z.array(edgeSchema).default([]),
  variables: z.record(z.unknown()).default({}),
});

function detectCycles(nodes: z.infer<typeof nodeSchema>[], edges: z.infer<typeof edgeSchema>[]): boolean {
  const adj = new Map<string, string[]>();
  for (const node of nodes) adj.set(node.id, []);
  for (const edge of edges) {
    const list = adj.get(edge.source);
    if (list) list.push(edge.target);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recStack.add(nodeId);
    for (const neighbor of adj.get(nodeId) || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }
    recStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id) && dfs(node.id)) return true;
  }
  return false;
}

export async function listWorkflows(req: Request, res: Response) {
  const { status, search, page = '1', limit = '20' } = req.query;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) where.name = { contains: search as string, mode: 'insensitive' };

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));

  const [workflows, total] = await Promise.all([
    prisma.workflow.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        user: { select: { email: true } },
        _count: { select: { runs: true } },
      },
    }),
    prisma.workflow.count({ where }),
  ]);

  res.json({
    data: workflows,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
}

export async function getWorkflow(req: Request, res: Response) {
  const workflow = await prisma.workflow.findUnique({
    where: { id: String(req.params.id) },
    include: {
      user: { select: { email: true } },
      runs: { orderBy: { startedAt: 'desc' }, take: 10 },
    },
  });
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  res.json(workflow);
}

export async function createWorkflow(req: Request, res: Response) {
  try {
    const body = workflowSchema.parse(req.body);

    if (detectCycles(body.nodes, body.edges)) {
      res.status(400).json({ error: 'Workflow contains cycles' });
      return;
    }

    // Validate that all referenced agents exist
    const agentIds = [...new Set(body.nodes.map((n) => n.agentId))];
    const agents = await prisma.agent.findMany({ where: { id: { in: agentIds } } });
    if (agents.length !== agentIds.length) {
      res.status(400).json({ error: 'One or more referenced agents do not exist' });
      return;
    }

    const workflow = await prisma.workflow.create({
      data: {
        name: body.name,
        nodes: body.nodes as unknown as any,
        edges: body.edges as unknown as any,
        variables: body.variables as unknown as any,
        createdBy: req.user!.userId,
      },
    });

    req.log.info('Workflow created', { workflowId: workflow.id });
    res.status(201).json(workflow);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
}

export async function updateWorkflow(req: Request, res: Response) {
  try {
    const body = workflowSchema.partial().parse(req.body);

    if (body.nodes && body.edges && detectCycles(body.nodes, body.edges)) {
      res.status(400).json({ error: 'Workflow contains cycles' });
      return;
    }

    const existing = await prisma.workflow.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    const workflow = await prisma.workflow.update({
      where: { id: String(req.params.id) },
      data: {
        ...body as any,
        version: existing.version + 1,
      },
    });

    req.log.info('Workflow updated', { workflowId: workflow.id, version: workflow.version });
    res.json(workflow);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
}

export async function deleteWorkflow(req: Request, res: Response) {
  await prisma.workflow.delete({ where: { id: String(req.params.id) } });
  req.log.info('Workflow deleted', { workflowId: req.params.id });
  res.json({ message: 'Workflow deleted' });
}

export async function validateWorkflow(req: Request, res: Response) {
  const workflow = await prisma.workflow.findUnique({ where: { id: String(req.params.id) } });
  if (!workflow) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }

  const nodes = workflow.nodes as unknown as z.infer<typeof nodeSchema>[];
  const edges = workflow.edges as unknown as z.infer<typeof edgeSchema>[];
  const errors: string[] = [];

  if (nodes.length === 0) errors.push('Workflow has no nodes');
  if (detectCycles(nodes, edges)) errors.push('Workflow contains cycles');

  // Check all agents exist and are active
  const agentIds = [...new Set(nodes.map((n) => n.agentId))];
  const agents = await prisma.agent.findMany({ where: { id: { in: agentIds } } });
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  for (const node of nodes) {
    const agent = agentMap.get(node.agentId);
    if (!agent) errors.push(`Node "${node.label}": agent not found`);
    else if (!agent.active) errors.push(`Node "${node.label}": agent "${agent.name}" is inactive`);
  }

  // Check edges reference existing nodes
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) errors.push(`Edge references non-existent source node: ${edge.source}`);
    if (!nodeIds.has(edge.target)) errors.push(`Edge references non-existent target node: ${edge.target}`);
  }

  if (errors.length > 0) {
    res.json({ valid: false, errors });
  } else {
    res.json({ valid: true, errors: [] });
  }
}
