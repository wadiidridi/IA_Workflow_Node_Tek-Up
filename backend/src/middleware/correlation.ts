import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      log: ReturnType<typeof createLogger>;
    }
  }
}

export function correlationMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  req.log = createLogger({ correlationId: req.correlationId });
  req.log.info(`${req.method} ${req.path}`);
  next();
}
