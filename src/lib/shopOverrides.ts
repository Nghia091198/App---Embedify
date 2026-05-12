import type { WidgetConfigParsed } from '../types/widget.js';

/**
 * Override config per-shop — không dùng if/else hardcode trong business logic.
 * Thêm orgId vào đây khi cần customize riêng cho 1 shop cụ thể.
 * Deploy lại để có hiệu lực.
 */
export interface ShopOverride {
  /** Ghi đè bất kỳ field nào trong WidgetConfigParsed */
  config?: Partial<WidgetConfigParsed>;
  /** Ghi chú nội bộ — tại sao shop này cần override */
  _note?: string;
}

/**
 * Map orgId → override.
 * Ví dụ:
 *   '200000123456': {
 *     config: { max_products_per_block: 30 },
 *     _note: 'Shop VIP, nâng giới hạn theo hợp đồng',
 *   },
 */
export const SHOP_OVERRIDES: Record<string, ShopOverride> = {
  // '200000123456': {
  //   config: { primary_color: '#0055ff', max_products_per_block: 30 },
  //   _note: 'Shop enterprise - thoả thuận riêng',
  // },
};

/** Trả về override cho shop, hoặc {} nếu không có */
export function getShopOverride(orgId: string): ShopOverride {
  return SHOP_OVERRIDES[orgId] ?? {};
}
