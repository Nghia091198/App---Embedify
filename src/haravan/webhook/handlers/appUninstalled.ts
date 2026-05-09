import type { Request } from 'express';
import {
  deleteProfileBindingsByOrgId,
  deleteSessionsByOrgId,
  deleteWidgetDataByOrgId,
} from '../../../db/sessionStore.js';

function parseOrgId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const v = b.org_id ?? b.orgid ?? b.organization_id;
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number') return String(v);
  return null;
}

/** Response đã 200 ở router /hook — chỉ cleanup. */
export async function handleAppUninstalled(req: Request): Promise<void> {
  const orgId = parseOrgId(req.body);
  if (!orgId) return;
  try {
    await deleteWidgetDataByOrgId(orgId);
    await deleteSessionsByOrgId(orgId);
    await deleteProfileBindingsByOrgId(orgId);
  } catch {
    /* Haravan retry */
  }
}
