import { getSupabaseAdmin } from './client.js';
import { getShopOverride } from '../lib/shopOverrides.js';
import { WIDGET_DEFAULTS } from '../lib/widgetDefaults.js';
import type { WidgetConfigKey, WidgetConfigParsed } from '../types/widget.js';

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; rows: Record<string, string> }>();

function cacheKey(orgId: string) {
  return orgId;
}

/** Chỉ dùng làm fallback khi merge response admin (đã lỗi thời — ưu tiên `getWidgetConfigParsed`). */
export const WIDGET_CONFIG_DEFAULTS: WidgetConfigParsed = {
  show_hidden_products: WIDGET_DEFAULTS.SHOW_HIDDEN_PRODUCTS,
  max_blocks_per_content: WIDGET_DEFAULTS.MAX_BLOCKS_PER_CONTENT,
  max_products_per_block: WIDGET_DEFAULTS.MAX_PRODUCTS_PER_BLOCK,
  enable_add_to_cart: true,
  enable_quick_view: false,
  primary_color: '#e84040',
  theme_page_bg: '',
  theme_page_text: '',
  theme_title_text: '',
  theme_border_color: '',
  theme_button_color: '',
  theme_link_hover_color: '',
  show_price: true,
  enable_contact: false,
  contact_label: 'Liên hệ',
  contact_url: '',
  custom_css: '',
  font_import_url: '',
  font_family: '',
};

export function parseWidgetConfig(rows: Record<string, string>): WidgetConfigParsed {
  const g = (k: WidgetConfigKey, d: string) => rows[k] ?? d;
  return {
    show_hidden_products: WIDGET_DEFAULTS.SHOW_HIDDEN_PRODUCTS,
    max_blocks_per_content: WIDGET_DEFAULTS.MAX_BLOCKS_PER_CONTENT,
    max_products_per_block: WIDGET_DEFAULTS.MAX_PRODUCTS_PER_BLOCK,
    enable_add_to_cart: g('enable_add_to_cart', 'true') !== 'false',
    enable_quick_view: g('enable_quick_view', 'false') === 'true',
    primary_color: g('primary_color', '#e84040').trim() || '#e84040',
    theme_page_bg: g('theme_page_bg', '').trim(),
    theme_page_text: g('theme_page_text', '').trim(),
    theme_title_text: g('theme_title_text', '').trim(),
    theme_border_color: g('theme_border_color', '').trim(),
    theme_button_color: g('theme_button_color', '').trim(),
    theme_link_hover_color: g('theme_link_hover_color', '').trim(),
    show_price: g('show_price', 'true') !== 'false',
    enable_contact: g('enable_contact', 'false') === 'true',
    contact_label: g('contact_label', 'Liên hệ'),
    contact_url: g('contact_url', ''),
    custom_css: g('custom_css', ''),
    font_import_url: g('font_import_url', ''),
    font_family: g('font_family', ''),
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
  const base = parseWidgetConfig(rows);
  const override = getShopOverride(orgId);
  if (override.config && Object.keys(override.config).length > 0) {
    return { ...base, ...override.config };
  }
  return base;
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
