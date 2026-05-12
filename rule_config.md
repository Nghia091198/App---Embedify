# Rule — cấu hình cố định (không qua UI Thiết lập)

Các giá trị sau **áp dụng cho mọi shop**, không lưu trong DB. Đổi bằng cách sửa code và deploy.

| Hằng số | Giá trị | Ý nghĩa |
|--------|---------|---------|
| `MAX_BLOCKS_PER_CONTENT` | `5` | Số block tối đa trên một nội dung (article / page / product). |
| `MAX_PRODUCTS_PER_BLOCK` | `15` | Số sản phẩm tối đa trong một block. |
| `SHOW_HIDDEN_PRODUCTS` | `false` | Có đưa sản phẩm ẩn vào danh sách chọn trong admin hay không. |

Nguồn: `src/lib/widgetDefaults.ts` (`WIDGET_DEFAULTS`).
