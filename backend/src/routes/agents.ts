import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
} from '../controllers/agents';

const router = Router();

router.use(authMiddleware);

router.get('/', listAgents);
router.get('/:id', getAgent);
router.post('/', requireRole('ADMIN'), createAgent);
router.put('/:id', requireRole('ADMIN'), updateAgent);
router.delete('/:id', requireRole('ADMIN'), deleteAgent);

export default router;
