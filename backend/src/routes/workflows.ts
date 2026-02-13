import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  validateWorkflow,
} from '../controllers/workflows';

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /workflows:
 *   get:
 *     tags: [Workflows]
 *     summary: List workflows for the current user
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, RUNNING, SUCCESS, FAILED]
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
 *         description: Paginated list of workflows
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
 *                         $ref: '#/components/schemas/Workflow'
 */
router.get('/', listWorkflows);

/**
 * @openapi
 * /workflows/{id}:
 *   get:
 *     tags: [Workflows]
 *     summary: Get workflow by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Workflow details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workflow'
 *       404:
 *         description: Workflow not found
 */
router.get('/:id', getWorkflow);

/**
 * @openapi
 * /workflows:
 *   post:
 *     tags: [Workflows]
 *     summary: Create a new workflow
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WorkflowCreate'
 *     responses:
 *       201:
 *         description: Workflow created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workflow'
 *       400:
 *         description: Validation error (e.g., cycle detected)
 */
router.post('/', createWorkflow);

/**
 * @openapi
 * /workflows/{id}:
 *   put:
 *     tags: [Workflows]
 *     summary: Update a workflow
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
 *             $ref: '#/components/schemas/WorkflowCreate'
 *     responses:
 *       200:
 *         description: Workflow updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workflow'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Workflow not found
 */
router.put('/:id', updateWorkflow);

/**
 * @openapi
 * /workflows/{id}:
 *   delete:
 *     tags: [Workflows]
 *     summary: Delete a workflow
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Workflow deleted
 *       404:
 *         description: Workflow not found
 */
router.delete('/:id', deleteWorkflow);

/**
 * @openapi
 * /workflows/{id}/validate:
 *   post:
 *     tags: [Workflows]
 *     summary: Validate workflow DAG (check for cycles, missing agents)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Validation result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationResult'
 *       404:
 *         description: Workflow not found
 */
router.post('/:id/validate', validateWorkflow);

export default router;
