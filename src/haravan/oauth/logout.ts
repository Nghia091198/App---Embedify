import type { Request, Response } from 'express';
import { SESSION_COOKIE } from '../authMiddleware.js';

export function logoutHandler(_req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
}
