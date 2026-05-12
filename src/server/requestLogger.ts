import type { NextFunction, Response } from 'express';
import type { HaravanRequest } from '../haravan/authMiddleware.js';
import { logger } from '../lib/logger.js';

export function requestLogger(req: HaravanRequest, res: Response, next: NextFunction): void {
  const start = Date.now();
  const orgId = req.haravanSession?.orgid ?? null;

  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const ctx = {
      org_id: orgId,
      route: req.path,
      status,
      ms,
    };
    const line = `${req.method} ${req.path} ${status} ${ms}ms`;
    if (status >= 500) logger.error(line, ctx);
    else if (status >= 400) logger.warn(line, ctx);
    else logger.info(line, ctx);
  });

  next();
}
