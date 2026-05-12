import type { Response } from 'express';
import { getShopDomain } from '../../lib/haravanApi.js';
import type { HaravanRequest } from '../authMiddleware.js';

function shopDomainFromSessionShopInfo(shopInfo: unknown): string | null {
  if (!shopInfo || typeof shopInfo !== 'object' || Array.isArray(shopInfo)) return null;
  const info = shopInfo as Record<string, unknown>;
  const raw = typeof info.shop_domain === 'string' ? info.shop_domain.trim() : '';
  if (!raw) return null;
  return raw.replace(/^https?:\/\//i, '').replace(/\/$/, '') || null;
}

/** Luôn gọi shop.json — `shop_domain` dùng cho `https://{shop_domain}/{link}` trên storefront. */
export async function meHandler(req: HaravanRequest, res: Response): Promise<void> {
  const s = req.haravanSession;
  if (!s) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  let shopDomain: string | null = null;
  try {
    shopDomain = await getShopDomain(s.access_token);
  } catch {
    shopDomain = null;
  }
  if (!shopDomain) {
    shopDomain = shopDomainFromSessionShopInfo(s.shop_info);
  }

  res.json({
    user_sub: s.user_sub,
    email: s.user_email,
    name: s.user_name,
    orgid: s.orgid,
    orgname: s.orgname,
    shop_domain: shopDomain,
  });
}
