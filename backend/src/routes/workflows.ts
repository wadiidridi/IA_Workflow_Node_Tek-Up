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

router.get('/', listWorkflows);
router.get('/:id', getWorkflow);
router.post('/', createWorkflow);
router.put('/:id', updateWorkflow);
router.delete('/:id', deleteWorkflow);
router.post('/:id/validate', validateWorkflow);

export default router;
