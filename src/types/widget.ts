export type WidgetContentType = 'article' | 'page' | 'product';

export type BlockPosition = 'start' | `after_p_${number}` | 'end';

export type BlockDisplayType = 'grid' | 'slider';

export interface ProductImage {
  id: string | null;
  src: string;
  alt: string | null;
  position: number | null;
  width: number | null;
  height: number | null;
  variant_ids: string[];
}

export interface ProductVariant {
  id: string;
  product_id: string | null;
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  sku: string | null;
  barcode: string | null;
  /** Giá thô (số), KHÔNG nhân 100 như Shopify. Haravan dùng VND nguyên đơn vị. */
  price: number | null;
  compare_at_price: number | null;
  /** "1.500.000 ₫" — định dạng sẵn để render không cần Intl ở client */
  formatted_price: string | null;
  formatted_compare_at_price: string | null;
  available: boolean;
  inventory_quantity: number | null;
  inventory_management: string | null;
  inventory_policy: string | null;
  requires_shipping: boolean;
  taxable: boolean;
  weight: number | null;
  weight_unit: string | null;
  grams: number | null;
  position: number | null;
  featured_image: ProductImage | null;
}

/**
 * Mirror Haravan storefront `product.js` (snake_case) + `formatted_price` để render thẳng.
 * Field naming/semantics khớp `/products/{handle}.js` của Haravan.
 */
export interface ProductSnapshot {
  id: string;
  title: string;
  handle: string;
  /** Path storefront (vd. `/products/<handle>` hoặc path từ API); preview ghép `shop_domain` + `/` + link bỏ slash đầu. */
  url: string;
  /** body_html đã strip HTML */
  description: string;
  body_html: string | null;
  vendor: string | null;
  /** product_type ở admin API */
  type: string | null;
  tags: string[];
  /** Tên các option, ví dụ ["Size","Color"] — giống product.js storefront */
  options: string[];
  price: number | null;
  price_min: number | null;
  price_max: number | null;
  price_varies: boolean;
  compare_at_price: number | null;
  compare_at_price_min: number | null;
  compare_at_price_max: number | null;
  compare_at_price_varies: boolean;
  formatted_price: string | null;
  formatted_compare_at_price: string | null;
  available: boolean;
  published: boolean;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** URL ảnh đại diện (storefront-style) */
  featured_image: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
  /** Tiện lợi: sku của variant đầu tiên */
  sku: string | null;
}

export interface WidgetBlockRow {
  id: string;
  org_id: string;
  content_type: WidgetContentType;
  content_id: string;
  block_index: number;
  title: string | null;
  position: string;
  display_type: BlockDisplayType;
  grid_desktop_cols: 2 | 3 | 4 | 5;
  grid_mobile_cols: 1 | 2;
  /** Khoảng cách giữa các ô sản phẩm (grid + slider), px — clamp 8–48 khi lưu. */
  grid_gap_px: number;
  slider_desktop_count: number;
  slider_mobile_count: number;
  product_ids: string[];
  products_cache: ProductSnapshot[];
  created_at: string;
  updated_at: string;
}

export interface WidgetBlockInput {
  id?: string;
  block_index: number;
  title: string | null;
  position: string;
  display_type: BlockDisplayType;
  grid_desktop_cols: 2 | 3 | 4 | 5;
  grid_mobile_cols: 1 | 2;
  grid_gap_px: number;
  slider_desktop_count: number;
  slider_mobile_count: number;
  product_ids: string[];
}

export type WidgetConfigKey =
  | 'show_hidden_products'
  | 'max_blocks_per_content'
  | 'max_products_per_block'
  | 'enable_add_to_cart'
  | 'enable_quick_view'
  | 'primary_color'
  | 'theme_page_bg'
  | 'theme_page_text'
  | 'theme_title_text'
  | 'theme_border_color'
  | 'theme_button_color'
  | 'theme_link_hover_color'
  | 'show_price'
  | 'enable_contact'
  | 'contact_label'
  | 'contact_url'
  | 'custom_css'
  | 'font_import_url'
  | 'font_family';

export interface WidgetConfigParsed {
  show_hidden_products: boolean;
  max_blocks_per_content: number;
  max_products_per_block: number;
  enable_add_to_cart: boolean;
  enable_quick_view: boolean;
  primary_color: string;
  /** Rỗng = dùng mặc định giao diện widget */
  theme_page_bg: string;
  theme_page_text: string;
  theme_title_text: string;
  theme_border_color: string;
  /** Rỗng = dùng màu chủ đạo */
  theme_button_color: string;
  theme_link_hover_color: string;
  show_price: boolean;
  enable_contact: boolean;
  contact_label: string;
  contact_url: string;
  custom_css: string;
  font_import_url: string;
  font_family: string;
}

/** Cờ render block (admin preview + HTML tĩnh Haravan; iframe lấy config live từ API). */
export interface WidgetPublicRenderFlags {
  enable_add_to_cart: boolean;
  enable_quick_view: boolean;
  show_price: boolean;
  enable_contact: boolean;
  contact_label: string;
  contact_url: string;
  /**
   * Chỉ dùng admin preview: `https://shop-domain` (không slash cuối).
   * Khi có — link sản phẩm trong block dùng URL tuyệt đối tới storefront; khi không — `/products/...` (đúng khi HTML nằm trên shop).
   */
  product_link_base?: string | null;
}

export interface AdminContentListItem {
  id: string;
  title: string;
  handle: string;
  /** Chỉ article: cần để fetch chi tiết */
  blog_id?: string;
  /** Handle blog (URL) — article */
  blog_handle?: string;
  body_html?: string;
  sku?: string;
  price?: string;
  available?: boolean;
  published?: boolean;
  thumbnail?: string | null;
}

export interface AdminContentsResponse {
  items: AdminContentListItem[];
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface AdminProductsResponse {
  items: AdminContentListItem[];
  page: number;
  page_size: number;
  has_more: boolean;
}
