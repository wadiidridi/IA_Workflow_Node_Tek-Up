import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { createRun, getRun, listRuns, streamRun } from '../controllers/runs';

const router = Router();

router.use(authMiddleware);

router.post('/', createRun);
router.get('/', listRuns);
router.get('/:id', getRun);
router.get('/:id/stream', streamRun);

export default router;
