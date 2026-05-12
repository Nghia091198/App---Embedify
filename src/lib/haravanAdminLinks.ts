import type { WidgetContentType } from '@/types/widget';

/** Admin Haravan (kênh Online Store): đường dẫn cũ `/admin/blogs/...` thường 404. */
const ADMIN_ONLINE_STORE = '/admin/sale_channels/online_store';

/**
 * Link chỉnh sửa nội dung trên admin Haravan (domain từ shop.json).
 */
export function buildHaravanAdminEditUrl(
  shopHost: string | null | undefined,
  contentType: WidgetContentType,
  contentId: string,
  blogId?: string | null,
): string | null {
  const h = shopHost?.trim();
  if (!h) return null;
  const host = h.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const base = `https://${host}`;
  if (contentType === 'article') {
    const bid = blogId?.trim();
    if (!bid) return null;
    return `${base}${ADMIN_ONLINE_STORE}/blogs/${bid}/articles/${contentId}`;
  }
  if (contentType === 'page') {
    return `${base}${ADMIN_ONLINE_STORE}/pages/${contentId}`;
  }
  if (contentType === 'product') {
    return `${base}${ADMIN_ONLINE_STORE}/products/${contentId}`;
  }
  return null;
}
