import type { NextFunction, Request, Response } from 'express';
import { getHaravanSessionById, type HaravanSessionRow } from '../db/sessionStore.js';

export const SESSION_COOKIE = 'wg_sid';

export interface HaravanRequest extends Request {
  haravanSession?: HaravanSessionRow;
}

export async function loadHaravanSession(req: HaravanRequest, res: Response, next: NextFunction): Promise<void> {
  const sid = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!sid) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  try {
    const row = await getHaravanSessionById(sid);
    if (!row) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    req.haravanSession = row;
    next();
  } catch {
    res.status(500).json({ error: 'session_error' });
  }
}
