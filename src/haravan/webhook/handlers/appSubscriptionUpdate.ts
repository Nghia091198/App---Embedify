import type { Request } from 'express';
import { logger } from '../../../lib/logger.js';
import { getSupabaseAdmin } from '../../../db/client.js';

interface HaravanSubscriptionWebhook {
  org_id?: string | number;
  orgid?: string | number;
  app_subscription?: {
    id?: string | number;
    status?: string;
    name?: string;
    created_at?: string;
    updated_at?: string;
    activated_on?: string;
    billing_on?: string;
    trial_ends_on?: string;
  };
}

function parseOrgId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const v = b.org_id ?? b.orgid ?? b.organization_id;
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number') return String(v);
  return null;
}

/**
 * Webhook `app_subscriptions/update` — billing Haravan.
 * Chủ yếu log + upsert nhẹ bảng shop_subscriptions (cần migration database/database.sql).
 * Phần billing đầy đủ để TODO trong comment theo prompt gốc.
 */
export async function handleAppSubscriptionUpdate(req: Request): Promise<void> {
  const orgId = parseOrgId(req.body);
  const payload = req.body as HaravanSubscriptionWebhook;
  const subscription = payload.app_subscription;

  logger.info('app_subscription webhook received', {
    org_id: orgId,
    status: subscription?.status,
    plan: subscription?.name,
    charge_id: subscription?.id != null ? String(subscription.id) : undefined,
  });

  if (!orgId) {
    logger.warn('app_subscription: missing org_id');
    return;
  }

  /*
  TODO: Khi có scope billing đầy đủ — bật upsert paid_at / expires_at theo status.
  try {
    const admin = getSupabaseAdmin();
    ...
  } catch (err) { ... }
  */

  try {
    const admin = getSupabaseAdmin();
    await admin.from('shop_subscriptions').upsert(
      {
        org_id: orgId,
        plan: subscription?.name ?? 'free',
        status: subscription?.status ?? 'unknown',
        haravan_charge_id: subscription?.id != null ? String(subscription.id) : null,
        raw_payload: payload as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' },
    );
  } catch {
    /* bảng chưa migration hoặc lỗi DB — không chặn webhook */
  }
}
