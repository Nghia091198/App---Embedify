import type { Request, Response } from 'express';
import { installHandler } from './install.js';

export function loginHandler(req: Request, res: Response): void {
  void installHandler(req, res);
}
