import prisma from '../config/database';
import { createLogger } from '../utils/logger';
import { executeAgent } from './agentRunner';
import { emitRunEvent } from './eventBus';
import { sendRunCompletionEmail } from './emailService';

interface WorkflowNode {
  id: string;
  agentId: string;
  label: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  mappingIn: Record<string, unknown>;
  mappingOut: Record<string, unknown>;
  errorPolicy: 'STOP' | 'CONTINUE';
  maxRetries: number;
  backoffMs: number;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[][] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }

  for (const edge of edges) {
    adj.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  const levels: string[][] = [];
  let queue = nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);

  while (queue.length > 0) {
    levels.push([...queue]);
    const nextQueue: string[] = [];

    for (const nodeId of queue) {
      for (const neighbor of adj.get(nodeId) || []) {
        const newDeg = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) nextQueue.push(neighbor);
      }
    }
    queue = nextQueue;
  }

  return levels;
}

function resolveMapping(
  mapping: Record<string, unknown>,
  prompt: string,
  nodeOutputs: Map<string, Record<string, unknown>>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(mapping)) {
    if (typeof value === 'string') {
      if (value === '{{prompt}}') {
        resolved[key] = prompt;
      } else {
        // Match patterns like {{node-1.fieldName}}
        const match = value.match(/^\{\{([^.]+)\.(.+)\}\}$/);
        if (match) {
          const [, nodeId, field] = match;
          const outputs = nodeOutputs.get(nodeId);
          resolved[key] = outputs?.[field] ?? value;
        } else {
          resolved[key] = value;
        }
      }
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeWorkflow(runId: string, workflowId: string, prompt: string, userEmail: string) {
  const log = createLogger({ workflowId, runId });

  try {
    // Update run status to RUNNING
    await prisma.run.update({ where: { id: runId }, data: { status: 'RUNNING' } });
    await prisma.workflow.update({ where: { id: workflowId }, data: { status: 'RUNNING' } });

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new Error('Workflow not found');

    const nodes = workflow.nodes as unknown as WorkflowNode[];
    const edges = workflow.edges as unknown as WorkflowEdge[];

    // Get agents
    const agentIds = [...new Set(nodes.map((n) => n.agentId))];
    const agents = await prisma.agent.findMany({ where: { id: { in: agentIds } } });
    const agentMap = new Map(agents.map((a) => [a.id, a]));

    // Topological sort — returns levels of parallelizable nodes
    const levels = topologicalSort(nodes, edges);
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const nodeOutputs = new Map<string, Record<string, unknown>>();
    let runFailed = false;

    // Create RunSteps
    for (const node of nodes) {
      await prisma.runStep.create({
        data: {
          runId,
          nodeId: node.id,
          agentId: node.agentId,
          status: 'PENDING',
          errorPolicy: node.errorPolicy,
          maxRetries: node.maxRetries,
          backoffMs: node.backoffMs,
        },
      });
    }

    // Execute level by level
    for (const level of levels) {
      if (runFailed) break;

      const levelPromises = level.map(async (nodeId) => {
        const node = nodeMap.get(nodeId)!;
        const agent = agentMap.get(node.agentId);
        if (!agent) throw new Error(`Agent not found: ${node.agentId}`);

        const step = await prisma.runStep.findFirst({ where: { runId, nodeId } });
        if (!step) throw new Error(`RunStep not found for node ${nodeId}`);

        // Emit step start
        emitRunEvent({ type: 'step:start', runId, data: { nodeId, label: node.label, agentName: agent.name } });
        await prisma.runStep.update({
          where: { id: step.id },
          data: { status: 'RUNNING', startedAt: new Date() },
        });

        // Resolve inputs
        const inputs = resolveMapping(node.mappingIn, prompt, nodeOutputs);
        log.info(`Executing node ${node.label}`, { nodeId, inputs });

        let lastResult = null;
        let success = false;
        const attempts = node.maxRetries + 1;

        for (let attempt = 1; attempt <= attempts; attempt++) {
          if (attempt > 1) {
            const delay = node.backoffMs * Math.pow(2, attempt - 2);
            log.info(`Retry ${attempt}/${attempts} for node ${node.label} after ${delay}ms`);
            await sleep(delay);
          }

          lastResult = await executeAgent(agent.endpointUrl, { inputs, context: { workflowId, runId, nodeId } });

          emitRunEvent({
            type: 'step:log',
            runId,
            data: { nodeId, logs: lastResult.logs, attempt },
          });

          if (lastResult.status === 'success') {
            success = true;
            break;
          }

          await prisma.runStep.update({
            where: { id: step.id },
            data: { retryCount: attempt, logs: lastResult.logs as any },
          });
        }

        const endedAt = new Date();
        if (success && lastResult) {
          nodeOutputs.set(nodeId, lastResult.outputs);
          await prisma.runStep.update({
            where: { id: step.id },
            data: {
              status: 'SUCCESS',
              endedAt,
              durationMs: lastResult.metrics.durationMs,
              logs: lastResult.logs as any,
              inputPreview: inputs as any,
              outputPreview: lastResult.outputs as any,
            },
          });
          emitRunEvent({
            type: 'step:complete',
            runId,
            data: { nodeId, label: node.label, outputs: lastResult.outputs, durationMs: lastResult.metrics.durationMs },
          });
          log.info(`Node ${node.label} completed`, { nodeId, durationMs: lastResult.metrics.durationMs });
        } else {
          const errorMsg = lastResult?.error || 'Unknown error';
          await prisma.runStep.update({
            where: { id: step.id },
            data: {
              status: 'FAILED',
              endedAt,
              durationMs: lastResult?.metrics.durationMs ?? 0,
              logs: lastResult?.logs as any ?? [],
              inputPreview: inputs as any,
            },
          });
          emitRunEvent({
            type: 'step:error',
            runId,
            data: { nodeId, label: node.label, error: errorMsg },
          });
          log.error(`Node ${node.label} failed`, { nodeId, error: errorMsg });

          if (node.errorPolicy === 'STOP') {
            runFailed = true;
          }
        }
      });

      await Promise.all(levelPromises);
    }

    // Complete the run
    const endedAt = new Date();
    const run = await prisma.run.findUnique({ where: { id: runId } });
    const durationMs = run ? endedAt.getTime() - run.startedAt.getTime() : 0;
    const finalStatus = runFailed ? 'FAILED' : 'SUCCESS';

    await prisma.run.update({
      where: { id: runId },
      data: { status: finalStatus, endedAt, durationMs, error: runFailed ? 'One or more steps failed' : null },
    });
    await prisma.workflow.update({ where: { id: workflowId }, data: { status: finalStatus } });

    emitRunEvent({
      type: runFailed ? 'run:error' : 'run:complete',
      runId,
      data: { status: finalStatus, durationMs },
    });

    // Send email
    const steps = await prisma.runStep.findMany({
      where: { runId },
      include: { agent: { select: { name: true } } },
    });

    await sendRunCompletionEmail({
      workflowId,
      workflowName: workflow!.name,
      runId,
      status: finalStatus,
      durationMs,
      steps: steps.map((s) => ({
        nodeName: nodes.find((n) => n.id === s.nodeId)?.label || s.nodeId,
        agentName: s.agent.name,
        status: s.status,
        durationMs: s.durationMs,
        error: undefined,
      })),
      recipient: userEmail,
    });

    log.info(`Workflow execution completed`, { status: finalStatus, durationMs });
  } catch (err) {
    log.error('Workflow execution failed with exception', { error: (err as Error).message });
    await prisma.run.update({
      where: { id: runId },
      data: { status: 'FAILED', endedAt: new Date(), error: (err as Error).message },
    });
    await prisma.workflow.update({ where: { id: workflowId }, data: { status: 'FAILED' } });
    emitRunEvent({ type: 'run:error', runId, data: { error: (err as Error).message } });
  }
}
