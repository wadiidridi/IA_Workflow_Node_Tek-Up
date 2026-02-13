import { Request, Response } from 'express';
import prisma from '../config/database';

export async function getKpis(_req: Request, res: Response) {
  const [totalRuns, successRuns, allRuns, stepsByFamily, topAgents, durationBuckets] = await Promise.all([
    prisma.run.count(),
    prisma.run.count({ where: { status: 'SUCCESS' } }),
    prisma.run.findMany({
      where: { durationMs: { not: null } },
      select: { durationMs: true },
      orderBy: { durationMs: 'asc' },
    }),
    // Errors by family
    prisma.$queryRaw`
      SELECT a.family, COUNT(*)::int as error_count
      FROM "RunStep" rs
      JOIN "Agent" a ON rs."agentId" = a.id
      WHERE rs.status = 'FAILED'
      GROUP BY a.family
      ORDER BY error_count DESC
    ` as Promise<{ family: string; error_count: number }[]>,
    // Top agents by usage
    prisma.$queryRaw`
      SELECT a.id, a.name, a.family,
        COUNT(*)::int as usage_count,
        COUNT(CASE WHEN rs.status = 'SUCCESS' THEN 1 END)::int as success_count
      FROM "RunStep" rs
      JOIN "Agent" a ON rs."agentId" = a.id
      GROUP BY a.id, a.name, a.family
      ORDER BY usage_count DESC
      LIMIT 10
    ` as Promise<{ id: string; name: string; family: string; usage_count: number; success_count: number }[]>,
    // Duration distribution
    prisma.$queryRaw`
      SELECT
        CASE
          WHEN "durationMs" < 500 THEN '0-500ms'
          WHEN "durationMs" < 1000 THEN '500-1000ms'
          WHEN "durationMs" < 2000 THEN '1-2s'
          WHEN "durationMs" < 5000 THEN '2-5s'
          ELSE '5s+'
        END as bucket,
        COUNT(*)::int as count
      FROM "RunStep"
      WHERE "durationMs" IS NOT NULL
      GROUP BY bucket
      ORDER BY MIN("durationMs")
    ` as Promise<{ bucket: string; count: number }[]>,
  ]);

  const durations = allRuns.map((r) => r.durationMs!).filter(Boolean).sort((a, b) => a - b);
  const avg = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
  const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;
  const max = durations.length > 0 ? durations[durations.length - 1] : 0;

  res.json({
    successRate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) / 100 : 0,
    totalRuns,
    successRuns,
    duration: { avg, p50, p95, max },
    errorsByFamily: stepsByFamily,
    topAgents: topAgents.map((a) => ({
      ...a,
      successRate: a.usage_count > 0 ? Math.round((a.success_count / a.usage_count) * 100) / 100 : 0,
    })),
    durationDistribution: durationBuckets,
  });
}
