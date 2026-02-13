import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const correlationId = req.correlationId || 'unknown';
  logger.error(`Unhandled error [${correlationId}]: ${err.message}`, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error', correlationId });
}
