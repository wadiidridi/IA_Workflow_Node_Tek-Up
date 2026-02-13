import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getKpis } from '../controllers/kpis';

const router = Router();

router.use(authMiddleware);
router.get('/', getKpis);

export default router;
