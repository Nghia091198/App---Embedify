import { getSupabaseAdmin } from './client.js';
import type { BlockDisplayType, ProductSnapshot, WidgetBlockInput, WidgetBlockRow, WidgetContentType } from '../types/widget.js';

function mapRow(r: Record<string, unknown>): WidgetBlockRow {
  return {
    id: String(r.id),
    org_id: String(r.org_id),
    content_type: r.content_type as WidgetContentType,
    content_id: String(r.content_id),
    block_index: Number(r.block_index),
    title: r.title == null ? null : String(r.title),
    position: String(r.position),
    display_type: r.display_type as BlockDisplayType,
    grid_desktop_cols: r.grid_desktop_cols as 3 | 4 | 5,
    grid_mobile_cols: r.grid_mobile_cols as 1 | 2,
    slider_desktop_count: Number(r.slider_desktop_count),
    slider_mobile_count: Number(r.slider_mobile_count),
    product_ids: (r.product_ids as string[]) ?? [],
    products_cache: (r.products_cache as ProductSnapshot[]) ?? [],
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

  const rows = blocks.map((b) => ({
    org_id: orgId,
    content_type: contentType,
    content_id: contentId,
    block_index: b.block_index,
    title: b.title,
    position: b.position,
    display_type: b.display_type,
    grid_desktop_cols: b.grid_desktop_cols,
    grid_mobile_cols: b.grid_mobile_cols,
    slider_desktop_count: b.slider_desktop_count,
    slider_mobile_count: b.slider_mobile_count,
    product_ids: b.product_ids,
    products_cache: b.products_cache,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await admin.from('widget_blocks').insert(rows).select('*');
  if (error) throw error;
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}
