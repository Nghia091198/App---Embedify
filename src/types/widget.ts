export type WidgetContentType = 'article' | 'page' | 'product';

export type BlockPosition = 'start' | `after_p_${number}` | 'end';

export type BlockDisplayType = 'grid' | 'slider';

export interface ProductSnapshot {
  id: string;
  title: string;
  handle: string;
  sku: string | null;
  featured_image: string | null;
  price: string | null;
  compare_at_price: string | null;
  available: boolean;
  published: boolean;
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
  grid_desktop_cols: 3 | 4 | 5;
  grid_mobile_cols: 1 | 2;
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
  grid_desktop_cols: 3 | 4 | 5;
  grid_mobile_cols: 1 | 2;
  slider_desktop_count: number;
  slider_mobile_count: number;
  product_ids: string[];
}

export type WidgetConfigKey =
  | 'show_hidden_products'
  | 'max_blocks_per_content'
  | 'max_products_per_block'
  | 'enable_add_to_cart'
  | 'enable_quick_view';

export interface WidgetConfigParsed {
  show_hidden_products: boolean;
  max_blocks_per_content: number;
  max_products_per_block: number;
  enable_add_to_cart: boolean;
  enable_quick_view: boolean;
}

export interface AdminContentListItem {
  id: string;
  title: string;
  handle: string;
  /** Chỉ article: cần để fetch chi tiết */
  blog_id?: string;
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
