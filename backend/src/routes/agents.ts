import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
} from '../controllers/agents';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authMiddleware);

/**
 * @openapi
 * /agents:
 *   get:
 *     tags: [Agents]
 *     summary: List agents with search, filter, sort, pagination
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or family
 *       - in: query
 *         name: family
 *         schema:
 *           type: string
 *         description: Filter by family
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Filter by active status
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, family, createdAt, version]
 *         description: Sort field
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated list of agents
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Paginated'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Agent'
 */
router.get('/', asyncHandler(listAgents));

/**
 * @openapi
 * /agents/{id}:
 *   get:
 *     tags: [Agents]
 *     summary: Get agent by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Agent details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       404:
 *         description: Agent not found
 */
router.get('/:id', asyncHandler(getAgent));

/**
 * @openapi
 * /agents:
 *   post:
 *     tags: [Agents]
 *     summary: Create a new agent (admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AgentCreate'
 *     responses:
 *       201:
 *         description: Agent created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin role required
 */
router.post('/', requireRole('ADMIN'), asyncHandler(createAgent));

/**
 * @openapi
 * /agents/{id}:
 *   put:
 *     tags: [Agents]
 *     summary: Update an agent (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AgentCreate'
 *     responses:
 *       200:
 *         description: Agent updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       403:
 *         description: Admin role required
 *       404:
 *         description: Agent not found
 */
router.put('/:id', requireRole('ADMIN'), asyncHandler(updateAgent));

/**
 * @openapi
 * /agents/{id}:
 *   delete:
 *     tags: [Agents]
 *     summary: Delete an agent (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Agent deleted
 *       403:
 *         description: Admin role required
 *       404:
 *         description: Agent not found
 */
router.delete('/:id', requireRole('ADMIN'), asyncHandler(deleteAgent));

export default router;
