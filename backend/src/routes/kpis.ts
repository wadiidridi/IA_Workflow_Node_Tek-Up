import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getKpis } from '../controllers/kpis';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authMiddleware);

/**
 * @openapi
 * /kpis:
 *   get:
 *     tags: [KPIs]
 *     summary: Get aggregated KPI data
 *     description: Returns dashboard metrics including success rate, duration stats, top agents, error breakdown, and duration distribution.
 *     responses:
 *       200:
 *         description: KPI data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KpiData'
 */
router.get('/', asyncHandler(getKpis));

export default router;
