import { getSupabaseAdmin } from './client.js';
import type { WidgetConfigKey, WidgetConfigParsed } from '../types/widget.js';

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; rows: Record<string, string> }>();

function cacheKey(orgId: string) {
  return orgId;
}

export const WIDGET_CONFIG_DEFAULTS: WidgetConfigParsed = {
  show_hidden_products: false,
  max_blocks_per_content: 5,
  max_products_per_block: 15,
  enable_add_to_cart: true,
  enable_quick_view: false,
};

export function parseWidgetConfig(rows: Record<string, string>): WidgetConfigParsed {
  const g = (k: WidgetConfigKey, d: string) => rows[k] ?? d;
  return {
    show_hidden_products: g('show_hidden_products', 'false') === 'true',
    max_blocks_per_content: Math.max(1, Number(g('max_blocks_per_content', '5')) || 5),
    max_products_per_block: Math.max(1, Number(g('max_products_per_block', '15')) || 15),
    enable_add_to_cart: g('enable_add_to_cart', 'true') !== 'false',
    enable_quick_view: g('enable_quick_view', 'false') === 'true',
  };
}

export async function getWidgetConfigRows(orgId: string): Promise<Record<string, string>> {
  const ck = cacheKey(orgId);
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('widget_config').select('key, value').eq('org_id', orgId);
  if (error) throw error;
  const rows: Record<string, string> = {};
  for (const r of data ?? []) {
    rows[String((r as { key: string }).key)] = String((r as { value: string }).value);
  }
  cache.set(ck, { at: Date.now(), rows });
  return rows;
}

export async function getWidgetConfigParsed(orgId: string): Promise<WidgetConfigParsed> {
  const rows = await getWidgetConfigRows(orgId);
  return parseWidgetConfig(rows);
}

export function invalidateWidgetConfigCache(orgId: string): void {
  cache.delete(cacheKey(orgId));
}

export async function upsertWidgetConfig(orgId: string, key: string, value: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('widget_config').upsert({ org_id: orgId, key, value });
  if (error) throw error;
  invalidateWidgetConfigCache(orgId);
}
