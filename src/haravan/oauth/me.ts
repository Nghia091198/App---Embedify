import type { Response } from 'express';
import type { HaravanRequest } from '../authMiddleware.js';

export function meHandler(req: HaravanRequest, res: Response): void {
  const s = req.haravanSession;
  if (!s) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  res.json({
    user_sub: s.user_sub,
    email: s.user_email,
    name: s.user_name,
    orgid: s.orgid,
    orgname: s.orgname,
  });
}
