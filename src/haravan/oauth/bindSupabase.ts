import type { Response } from 'express';
import { getSupabaseAdmin } from '../../db/client.js';
import type { HaravanRequest } from '../authMiddleware.js';

export async function bindSupabaseHandler(req: HaravanRequest, res: Response): Promise<void> {
  const orgId = req.haravanSession?.orgid;
  const supabaseUserId = typeof req.body?.supabase_user_id === 'string' ? req.body.supabase_user_id : '';
  if (!orgId || !supabaseUserId) {
    res.status(400).json({ error: 'missing_fields' });
    return;
  }
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from('haravan_profile_bindings').upsert({
      supabase_user_id: supabaseUserId,
      haravan_org_id: orgId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'bind_failed' });
  }
}
