import type { Response } from 'express';
import type { HaravanRequest } from '../authMiddleware.js';

export function crawlerContextHandler(_req: HaravanRequest, res: Response): void {
  res.json({});
}
