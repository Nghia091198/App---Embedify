import { getSupabaseAdmin } from './client.js';
import type {
  BlockDisplayType,
  ProductImage,
  ProductSnapshot,
  ProductVariant,
  WidgetBlockInput,
  WidgetBlockRow,
  WidgetContentType,
} from '../types/widget.js';

/** Fill defaults cho snapshot cũ (rows trước khi mở rộng schema). */
function normalizeSnapshot(raw: unknown): ProductSnapshot {
  const p = (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>;
  const handle = String(p.handle ?? '');
  return {
    id: String(p.id ?? ''),
    title: String(p.title ?? ''),
    handle,
    url: typeof p.url === 'string' ? p.url : handle ? `/products/${handle}` : '',
    description: typeof p.description === 'string' ? p.description : '',
    body_html: typeof p.body_html === 'string' ? p.body_html : null,
    vendor: typeof p.vendor === 'string' ? p.vendor : null,
    type: typeof p.type === 'string' ? p.type : null,
    tags: Array.isArray(p.tags) ? (p.tags as unknown[]).map(String) : [],
    options: Array.isArray(p.options) ? (p.options as unknown[]).map(String) : [],
    price: typeof p.price === 'number' ? p.price : null,
    price_min: typeof p.price_min === 'number' ? p.price_min : null,
    price_max: typeof p.price_max === 'number' ? p.price_max : null,
    price_varies: p.price_varies === true,
    compare_at_price: typeof p.compare_at_price === 'number' ? p.compare_at_price : null,
    compare_at_price_min: typeof p.compare_at_price_min === 'number' ? p.compare_at_price_min : null,
    compare_at_price_max: typeof p.compare_at_price_max === 'number' ? p.compare_at_price_max : null,
    compare_at_price_varies: p.compare_at_price_varies === true,
    formatted_price:
      typeof p.formatted_price === 'string'
        ? p.formatted_price
        : typeof p.price === 'string' /* legacy: price là string đã format */
          ? (p.price as string)
          : null,
    formatted_compare_at_price:
      typeof p.formatted_compare_at_price === 'string' ? p.formatted_compare_at_price : null,
    available: p.available !== false,
    published: p.published !== false,
    published_at: typeof p.published_at === 'string' ? p.published_at : null,
    created_at: typeof p.created_at === 'string' ? p.created_at : null,
    updated_at: typeof p.updated_at === 'string' ? p.updated_at : null,
    featured_image: typeof p.featured_image === 'string' ? p.featured_image : null,
    images: Array.isArray(p.images) ? (p.images as ProductImage[]) : [],
    variants: Array.isArray(p.variants) ? (p.variants as ProductVariant[]) : [],
    sku: typeof p.sku === 'string' ? p.sku : null,
  };
}

function mapRow(r: Record<string, unknown>): WidgetBlockRow {
  const rawCache = r.products_cache;
  let rawArr: unknown[] = [];
  if (Array.isArray(rawCache)) {
    rawArr = rawCache;
  } else if (typeof rawCache === 'string') {
    try {
      const p = JSON.parse(rawCache) as unknown;
      rawArr = Array.isArray(p) ? p : [];
    } catch {
      rawArr = [];
    }
  }
  const products_cache: ProductSnapshot[] = rawArr.map(normalizeSnapshot);

  const rawGap = r.grid_gap_px;
  const gapNum = typeof rawGap === 'number' ? rawGap : Number(rawGap);
  const grid_gap_px = Number.isFinite(gapNum) ? Math.min(48, Math.max(8, Math.round(gapNum))) : 12;

  const rawDesk = Number(r.grid_desktop_cols);
  const grid_desktop_cols: 2 | 3 | 4 | 5 =
    rawDesk === 2 || rawDesk === 3 || rawDesk === 4 || rawDesk === 5 ? rawDesk : 4;

  return {
    id: String(r.id),
    org_id: String(r.org_id),
    content_type: r.content_type as WidgetContentType,
    content_id: String(r.content_id),
    block_index: Number(r.block_index),
    title: (() => {
      if (r.title == null) return null;
      const t = String(r.title).trim();
      return t.length > 0 ? t : null;
    })(),
    position: String(r.position),
    display_type: r.display_type as BlockDisplayType,
    grid_desktop_cols,
    grid_mobile_cols: r.grid_mobile_cols as 1 | 2,
    grid_gap_px,
    slider_desktop_count: Number(r.slider_desktop_count),
    slider_mobile_count: Number(r.slider_mobile_count),
    product_ids: (r.product_ids as string[]) ?? [],
    products_cache,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function listBlocksForContent(
  orgId: string,
  contentType: WidgetContentType,
  contentId: string,
): Promise<WidgetBlockRow[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('widget_blocks')
    .select('*')
    .eq('org_id', orgId)
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .order('block_index', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function replaceBlocksForContent(
  orgId: string,
  contentType: WidgetContentType,
  contentId: string,
  blocks: Array<WidgetBlockInput & { products_cache: ProductSnapshot[] }>,
): Promise<WidgetBlockRow[]> {
  const admin = getSupabaseAdmin();

  const { error: delErr } = await admin
    .from('widget_blocks')
    .delete()
    .eq('org_id', orgId)
    .eq('content_type', contentType)
    .eq('content_id', contentId);
  if (delErr) throw delErr;

  if (blocks.length === 0) return [];

  const now = new Date().toISOString();
  const rows = blocks.map((b) => ({
    org_id: orgId,
    content_type: contentType,
    content_id: contentId,
    block_index: b.block_index,
    title: b.title ?? null,
    position: b.position,
    display_type: b.display_type,
    grid_desktop_cols: b.grid_desktop_cols,
    grid_mobile_cols: b.grid_mobile_cols,
    grid_gap_px: b.grid_gap_px,
    slider_desktop_count: b.slider_desktop_count,
    slider_mobile_count: b.slider_mobile_count,
    product_ids: b.product_ids,
    products_cache: b.products_cache,
    updated_at: now,
  }));

  const { error: insErr } = await admin.from('widget_blocks').insert(rows);
  if (insErr) throw insErr;

  const { data, error: selErr } = await admin
    .from('widget_blocks')
    .select('*')
    .eq('org_id', orgId)
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .order('block_index', { ascending: true });
  if (selErr) throw selErr;

  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}
