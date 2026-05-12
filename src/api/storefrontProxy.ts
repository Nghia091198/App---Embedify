import type { Request, Response } from 'express';
import { getHaravanSessionById, getHaravanSessionByOrgId } from '../db/sessionStore.js';
import { SESSION_COOKIE } from '../haravan/authMiddleware.js';
import { getShopDomain } from '../lib/haravanApi.js';

/**
 * Lấy shop_domain từ session row (ưu tiên shop_info.shop_domain, fallback gọi /com/shop.json).
 */
async function resolveShopDomain(session: { access_token: string; shop_info: unknown }): Promise<string | null> {
  if (session.shop_info && typeof session.shop_info === 'object' && !Array.isArray(session.shop_info)) {
    const info = session.shop_info as Record<string, unknown>;
    if (typeof info.shop_domain === 'string' && info.shop_domain.trim()) {
      return info.shop_domain.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
    }
  }
  return getShopDomain(session.access_token).catch(() => null);
}

/**
 * Proxy POST /cart/add.js từ iframe (app domain) → app server → Haravan storefront.
 * iframe không gọi trực tiếp được vì cross-origin (app domain ≠ storefront domain).
 *
 * Body: { variantId: string, quantity?: number }
 * Query: ?org_id=<orgid> (fallback khi không có cookie session)
 *
 * QUAN TRỌNG: Cart phía Haravan storefront thuộc shopper (cookie storefront), nhưng request
 * này đi từ server app → Haravan: KHÔNG mang được cookie shopper.
 * → /cart/add.js trả về JSON OK nhưng KHÔNG add vào giỏ thật của shopper.
 *
 * Giải pháp thực tế: response trả lại cho iframe, iframe gửi tiếp postMessage `wg-cart-updated`
 * → snippet trên page parent dùng cookie shopper sẽ làm refresh /cart.js để cập nhật count.
 *
 * Lưu ý: muốn add đúng cookie shopper, phải redirect / gọi trực tiếp từ TOP frame qua
 * snippet. Endpoint này dùng để verify variant tồn tại + lấy thông tin item.
 */
export async function storefrontCartAddProxy(req: Request, res: Response): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const body = (req.body ?? {}) as { variantId?: string | number; quantity?: number };
  const variantId = body.variantId == null ? '' : String(body.variantId).trim();
  const quantity = Math.max(1, Number(body.quantity) || 1);
  if (!variantId) {
    res.status(400).json({ error: 'missing_variant_id' });
    return;
  }

  const sid = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const orgIdFromQuery = String(req.query.org_id ?? '').trim();

  let session: { access_token: string; shop_info: unknown } | null = null;
  if (sid) {
    try {
      const row = await getHaravanSessionById(sid);
      if (row?.access_token) session = { access_token: row.access_token, shop_info: row.shop_info };
    } catch { /* ignore */ }
  }
  if (!session && orgIdFromQuery) {
    try {
      const row = await getHaravanSessionByOrgId(orgIdFromQuery);
      if (row?.access_token) session = { access_token: row.access_token, shop_info: row.shop_info };
    } catch { /* ignore */ }
  }

  if (!session) {
    res.status(401).json({ error: 'no_session' });
    return;
  }

  const shopDomain = await resolveShopDomain(session);
  if (!shopDomain) {
    res.status(400).json({ error: 'shop_domain_not_found' });
    return;
  }

  const formBody = `id=${encodeURIComponent(variantId)}&quantity=${encodeURIComponent(quantity)}`;

  try {
    const storeRes = await fetch(`https://${shopDomain}/cart/add.js`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01',
      },
      body: formBody,
    });

    const ct = storeRes.headers.get('content-type') || '';
    const payload = ct.includes('json') ? await storeRes.json() : await storeRes.text();

    res.status(storeRes.ok ? 200 : storeRes.status);
    res.setHeader('Content-Type', 'application/json');

    if (!storeRes.ok) {
      res.json({ error: 'store_error', status: storeRes.status, detail: payload });
      return;
    }

    res.json({ ok: true, item: payload, shop_domain: shopDomain });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[storefrontProxy] cart-add failed:', message);
    res.status(502).json({ error: 'proxy_failed', message });
  }
}
