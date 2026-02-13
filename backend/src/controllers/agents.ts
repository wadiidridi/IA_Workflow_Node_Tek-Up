import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';

const agentSchema = z.object({
  name: z.string().min(1).max(100),
  family: z.string().min(1).max(50),
  version: z.string().default('1.0.0'),
  schemaIn: z.record(z.unknown()),
  schemaOut: z.record(z.unknown()),
  endpointUrl: z.string().min(1),
  secrets: z.record(z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

function maskSecrets(secrets: unknown): Record<string, string> {
  if (!secrets || typeof secrets !== 'object') return {};
  const masked: Record<string, string> = {};
  for (const key of Object.keys(secrets as Record<string, unknown>)) {
    masked[key] = '****';
  }
  return masked;
}

export async function listAgents(req: Request, res: Response) {
  const { family, search, status, sortBy = 'createdAt', order = 'desc', page = '1', limit = '20' } = req.query;

  const where: Record<string, unknown> = {};
  if (family) where.family = family;
  if (status === 'active') where.active = true;
  if (status === 'inactive') where.active = false;
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { family: { contains: search as string, mode: 'insensitive' } },
      { tags: { has: search as string } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));

  const [agents, total] = await Promise.all([
    prisma.agent.findMany({
      where,
      orderBy: { [sortBy as string]: order },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.agent.count({ where }),
  ]);

  res.json({
    data: agents.map((a) => ({ ...a, secrets: maskSecrets(a.secrets) })),
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
}

export async function getAgent(req: Request, res: Response) {
  const agent = await prisma.agent.findUnique({ where: { id: String(req.params.id) } });
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json({ ...agent, secrets: maskSecrets(agent.secrets) });
}

export async function createAgent(req: Request, res: Response) {
  try {
    const body = agentSchema.parse(req.body);
    const agent = await prisma.agent.create({ data: body as any });
    req.log.info('Agent created', { agentId: agent.id, name: agent.name });
    res.status(201).json({ ...agent, secrets: maskSecrets(agent.secrets) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
}

export async function updateAgent(req: Request, res: Response) {
  try {
    const body = agentSchema.partial().parse(req.body);
    const agent = await prisma.agent.update({
      where: { id: String(req.params.id) },
      data: body as any,
    });
    req.log.info('Agent updated', { agentId: agent.id });
    res.json({ ...agent, secrets: maskSecrets(agent.secrets) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
}

export async function deleteAgent(req: Request, res: Response) {
  await prisma.agent.update({
    where: { id: String(req.params.id) },
    data: { active: false },
  });
  req.log.info('Agent deactivated', { agentId: req.params.id });
  res.json({ message: 'Agent deactivated' });
}
