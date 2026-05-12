/** Global constants — áp dụng cho tất cả shop, không lưu vào DB */
export const WIDGET_DEFAULTS = {
  /** Số block tối đa mỗi nội dung */
  MAX_BLOCKS_PER_CONTENT: 5,
  /** Số sản phẩm tối đa mỗi block */
  MAX_PRODUCTS_PER_BLOCK: 15,
  /** Hiển thị sản phẩm ẩn trong danh sách chọn */
  SHOW_HIDDEN_PRODUCTS: false,
} as const;
