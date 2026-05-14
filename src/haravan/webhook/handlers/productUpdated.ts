import type { Request } from 'express';
import { logger } from '../../../lib/logger.js';
import { getSupabaseAdmin } from '../../../db/client.js';
import type { ProductSnapshot } from '../../../types/widget.js';

interface HaravanProductWebhook {
  id?: number | string;
  title?: string;
  variants?: Array<{ id?: number | string; price?: string | number; formatted_price?: string }>;
  images?: Array<{ src?: string }>;
}

function parseOrgId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const v = b.org_id ?? b.orgid ?? b.organization_id;
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number') return String(v);
  return null;
}

function parseProductId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const nested = b.product;
  let v: unknown = b.id;
  if ((v === undefined || v === null) && nested && typeof nested === 'object') {
    v = (nested as Record<string, unknown>).id;
  }
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number') return String(v);
  return null;
}

function parseCache(raw: unknown): ProductSnapshot[] {
  if (Array.isArray(raw)) return raw as ProductSnapshot[];
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? (p as ProductSnapshot[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseProductIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter(Boolean);
}

function firstVariantPrice(
  product: HaravanProductWebhook,
): { price: number | null; formatted: string | null } {
  const v0 = product.variants?.[0];
  if (!v0) return { price: null, formatted: null };
  const fp = typeof v0.formatted_price === 'string' ? v0.formatted_price.trim() || null : null;
  if (typeof v0.price === 'number' && Number.isFinite(v0.price)) return { price: v0.price, formatted: fp };
  if (typeof v0.price === 'string') {
    const n = Number(v0.price.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(n)) return { price: n, formatted: fp };
  }
  return { price: null, formatted: fp };
}

/**
 * Khi merchant cập nhật sản phẩm trên Haravan:
 * tìm widget_blocks chứa product_id, merge snapshot trong products_cache.
 */
export async function handleProductUpdated(req: Request): Promise<void> {
  const body = req.body as unknown;
  const productId = parseProductId(body);
  const orgId = parseOrgId(body);
  if (!productId || !orgId) return;

  const product = body as HaravanProductWebhook;
  const { price: nextPrice, formatted: nextFormatted } = firstVariantPrice(product);
  const nextImage = product.images?.[0]?.src ?? null;
  const nextTitle = typeof product.title === 'string' ? product.title : null;

  try {
    const admin = getSupabaseAdmin();
    const { data: rows, error: fetchErr } = await admin
      .from('widget_blocks')
      .select('id, product_ids, products_cache')
      .eq('org_id', orgId);
    if (fetchErr || !rows?.length) return;

    const blocks = rows.filter((row) => {
      const ids = parseProductIds((row as Record<string, unknown>).product_ids);
      return ids.includes(String(productId));
    });
    if (blocks.length === 0) return;

    const now = new Date().toISOString();
    for (const row of blocks) {
      const rec = row as Record<string, unknown>;
      const blockId = String(rec.id);
      const cache = parseCache(rec.products_cache);
      const updated = cache.map((item) => {
        if (String(item.id) !== String(productId)) return item;
        return {
          ...item,
          ...(nextTitle != null ? { title: nextTitle } : {}),
          ...(nextPrice != null ? { price: nextPrice } : {}),
          ...(nextFormatted != null ? { formatted_price: nextFormatted } : {}),
          ...(nextImage != null ? { featured_image: nextImage } : {}),
          updated_at: now,
        };
      });

      const { error: upErr } = await admin
        .from('widget_blocks')
        .update({ products_cache: updated, updated_at: now })
        .eq('id', blockId);
      if (upErr) {
        logger.warn('product update block write failed', { org_id: orgId, block_id: blockId });
      }
    }

    logger.info('product updated in cache', {
      org_id: orgId,
      product_id: productId,
      blocks_affected: blocks.length,
    });
  } catch (err) {
    logger.warn('handleProductUpdated failed', { org_id: orgId, product_id: productId });
    console.error('[webhook] products/update error:', err);
  }
}
