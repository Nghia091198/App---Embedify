import type { Request } from 'express';
import { logger } from '../../../lib/logger.js';
import { getSupabaseAdmin } from '../../../db/client.js';
import type { ProductSnapshot } from '../../../types/widget.js';

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

/**
 * Khi merchant xóa sản phẩm: bỏ product_id khỏi block; block rỗng thì xóa block.
 */
export async function handleProductDeleted(req: Request): Promise<void> {
  const body = req.body as unknown;
  const productId = parseProductId(body);
  const orgId = parseOrgId(body);
  if (!productId || !orgId) return;

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
      const ids = parseProductIds(rec.product_ids);
      const newIds = ids.filter((id) => id !== String(productId));
      const cache = parseCache(rec.products_cache);
      const newCache = cache.filter((item) => String(item.id) !== String(productId));

      if (newIds.length === 0) {
        const { error: delErr } = await admin.from('widget_blocks').delete().eq('id', blockId);
        if (delErr) {
          logger.warn('product deleted block delete failed', { org_id: orgId, block_id: blockId });
        } else {
          logger.info('block deleted (empty after product removal)', {
            org_id: orgId,
            block_id: blockId,
            product_id: productId,
          });
        }
      } else {
        const { error: upErr } = await admin
          .from('widget_blocks')
          .update({ product_ids: newIds, products_cache: newCache, updated_at: now })
          .eq('id', blockId);
        if (upErr) {
          logger.warn('product deleted block update failed', { org_id: orgId, block_id: blockId });
        }
      }
    }

    logger.info('product deleted from blocks', {
      org_id: orgId,
      product_id: productId,
      blocks_affected: blocks.length,
    });
  } catch (err) {
    logger.warn('handleProductDeleted failed', { org_id: orgId, product_id: productId });
    console.error('[webhook] products/deleted error:', err);
  }
}
