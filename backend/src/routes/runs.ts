import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { createRun, getRun, listRuns, streamRun } from '../controllers/runs';

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /runs:
 *   post:
 *     tags: [Runs]
 *     summary: Start a new workflow run
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RunCreate'
 *     responses:
 *       201:
 *         description: Run started
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Run'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Workflow not found
 */
router.post('/', createRun);

/**
 * @openapi
 * /runs:
 *   get:
 *     tags: [Runs]
 *     summary: List runs with pagination
 *     parameters:
 *       - in: query
 *         name: workflowId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by workflow
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, RUNNING, SUCCESS, FAILED]
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
 *         description: Paginated list of runs
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
 *                         $ref: '#/components/schemas/Run'
 */
router.get('/', listRuns);

/**
 * @openapi
 * /runs/{id}:
 *   get:
 *     tags: [Runs]
 *     summary: Get run details with steps
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Run with steps and agent info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Run'
 *       404:
 *         description: Run not found
 */
router.get('/:id', getRun);

/**
 * @openapi
 * /runs/{id}/stream:
 *   get:
 *     tags: [Runs]
 *     summary: SSE stream of run progress (real-time)
 *     description: Server-Sent Events stream. Pass JWT as query param since EventSource cannot set headers.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: JWT token (since EventSource cannot set Authorization header)
 *     responses:
 *       200:
 *         description: SSE event stream
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       404:
 *         description: Run not found
 */
router.get('/:id/stream', streamRun);

export default router;
