import type { AdminContentListItem, AdminContentsResponse, AdminProductsResponse, ProductSnapshot } from '../types/widget.js';

const API = 'https://apis.haravan.com';

export async function haravanJson<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

function formatMoney(amount: string | number | null | undefined, currency = '₫'): string {
  if (amount == null || amount === '') return '';
  const n = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
  if (Number.isNaN(n)) return String(amount);
  return `${new Intl.NumberFormat('vi-VN').format(n)} ${currency}`.trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProductSummary(p: any): AdminContentListItem {
  const v0 = Array.isArray(p?.variants) ? p.variants[0] : null;
  const sku = v0?.sku != null ? String(v0.sku) : null;
  const price = v0?.price != null ? formatMoney(v0.price) : null;
  const inv = v0?.inventory_quantity;
  const available =
    p?.available === true ||
    (typeof inv === 'number' && inv > 0) ||
    (p?.variants?.some((x: { inventory_quantity?: number }) => (x?.inventory_quantity ?? 0) > 0) ?? false);
  const published = p?.published !== false && (p?.published_at != null || p?.status === 'active' || p?.published === true);
  const img =
    p?.image?.src ??
    (Array.isArray(p?.images) && p.images[0]?.src ? p.images[0].src : null) ??
    null;
  return {
    id: String(p.id),
    title: String(p.title ?? ''),
    handle: String(p.handle ?? ''),
    sku: sku ?? undefined,
    price: price ?? undefined,
    available,
    published: Boolean(published),
    body_html: undefined,
    thumbnail: img ?? undefined,
  };
}

export async function listProductsPage(
  accessToken: string,
  page: number,
  limit: number,
  q: string,
): Promise<AdminProductsResponse> {
  const qs = new URLSearchParams();
  qs.set('page', String(page));
  qs.set('limit', String(limit));
  qs.set('fields', 'id,title,handle,variants,images,image,published,published_at,available');
  const { ok, data } = await haravanJson<{ products?: unknown[] }>(
    `/com/products.json?${qs.toString()}`,
    accessToken,
  );
  if (!ok || !data?.products) {
    return { items: [], page, page_size: limit, has_more: false };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items = (data.products as any[]).map(mapProductSummary);
  const qq = q.trim().toLowerCase();
  if (qq) {
    items = items.filter(
      (it) => it.title.toLowerCase().includes(qq) || (it.sku && it.sku.toLowerCase().includes(qq)),
    );
  }
  const has_more = items.length >= limit;
  return { items, page, page_size: limit, has_more };
}

export async function fetchProductsByIds(accessToken: string, ids: string[]): Promise<AdminContentListItem[]> {
  const uniq = [...new Set(ids)].filter(Boolean);
  const out: AdminContentListItem[] = [];
  for (const id of uniq) {
    const { ok, data } = await haravanJson<{ product?: unknown }>(`/com/products/${id}.json`, accessToken);
    if (ok && data && data.product) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      out.push(mapProductSummary(data.product as any));
    }
  }
  return out;
}

export function toProductSnapshots(items: AdminContentListItem[]): ProductSnapshot[] {
  return items.map((p) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    sku: p.sku ?? null,
    featured_image: p.thumbnail ?? null,
    price: p.price ?? null,
    compare_at_price: null,
    available: p.available ?? true,
    published: p.published ?? true,
  }));
}

/** Bổ sung ảnh từ API chi tiết */
export async function enrichSnapshots(accessToken: string, snapshots: ProductSnapshot[]): Promise<ProductSnapshot[]> {
  const out: ProductSnapshot[] = [];
  for (const s of snapshots) {
    const { ok, data } = await haravanJson<{ product?: unknown }>(`/com/products/${s.id}.json`, accessToken);
    if (!ok || !data?.product) {
      out.push(s);
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = data.product as any;
    const img =
      p?.image?.src ??
      (Array.isArray(p?.images) && p.images[0]?.src ? p.images[0].src : null) ??
      null;
    const v0 = Array.isArray(p?.variants) ? p.variants[0] : null;
    const price = v0?.price != null ? formatMoney(v0.price) : s.price;
    const compare = v0?.compare_at_price != null ? formatMoney(v0.compare_at_price) : null;
    const inv = v0?.inventory_quantity;
    const available =
      p?.available === true ||
      (typeof inv === 'number' && inv > 0) ||
      (p?.variants?.some((x: { inventory_quantity?: number }) => (x?.inventory_quantity ?? 0) > 0) ?? false);
    const published = p?.published !== false;
    out.push({
      ...s,
      featured_image: img,
      price,
      compare_at_price: compare,
      available,
      published,
    });
  }
  return out;
}

export async function listPagesContent(
  accessToken: string,
  page: number,
  limit: number,
  q: string,
): Promise<AdminContentsResponse> {
  const qs = new URLSearchParams();
  qs.set('page', String(page));
  qs.set('limit', String(limit));
  qs.set('published_status', 'any');
  const { ok, data } = await haravanJson<{ pages?: { id: number; title: string; handle: string; body_html?: string }[] }>(
    `/web/pages.json?${qs.toString()}`,
    accessToken,
  );
  if (!ok || !data?.pages) return { items: [], page, page_size: limit, has_more: false };
  let items: AdminContentListItem[] = data.pages.map((p) => ({
    id: String(p.id),
    title: p.title,
    handle: p.handle,
  }));
  const qq = q.trim().toLowerCase();
  if (qq) items = items.filter((it) => it.title.toLowerCase().includes(qq) || it.handle.toLowerCase().includes(qq));
  const has_more = (data.pages?.length ?? 0) >= limit;
  return { items, page, page_size: limit, has_more };
}

export async function listArticlesAggregated(
  accessToken: string,
  page: number,
  limit: number,
  q: string,
): Promise<AdminContentsResponse> {
  const { ok, data } = await haravanJson<{ blogs?: { id: number }[] }>(`/web/blogs.json?limit=250`, accessToken);
  if (!ok || !data?.blogs) return { items: [], page, page_size: limit, has_more: false };

  type Art = {
    id: number;
    title: string;
    handle: string;
    blog_id: number;
    body_html?: string;
    updated_at?: string;
  };
  const all: Art[] = [];
  for (const b of data.blogs) {
    const r = await haravanJson<{ articles?: Art[] }>(
      `/web/blogs/${b.id}/articles.json?limit=250&page=1&published_status=any`,
      accessToken,
    );
    if (r.ok && r.data?.articles) {
      for (const a of r.data.articles) {
        all.push({ ...a, blog_id: b.id });
      }
    }
  }
  all.sort((x, y) => String(y.updated_at ?? '').localeCompare(String(x.updated_at ?? '')));
  let filtered = all;
  const qq = q.trim().toLowerCase();
  if (qq) filtered = all.filter((a) => a.title.toLowerCase().includes(qq) || a.handle.toLowerCase().includes(qq));
  const start = (page - 1) * limit;
  const slice = filtered.slice(start, start + limit);
  const items: AdminContentListItem[] = slice.map((a) => ({
    id: String(a.id),
    title: a.title,
    handle: a.handle,
    blog_id: String(a.blog_id),
  }));
  return { items, page, page_size: limit, has_more: start + limit < filtered.length };
}

export async function listProductsAsContent(
  accessToken: string,
  page: number,
  limit: number,
  q: string,
  showHidden: boolean,
): Promise<AdminContentsResponse> {
  const pr = await listProductsPage(accessToken, page, limit, q);
  let items = pr.items;
  if (!showHidden) {
    items = items.filter((p) => p.published !== false);
  }
  return {
    items: items.map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      sku: p.sku,
      price: p.price,
      available: p.available,
      published: p.published,
    })),
    page,
    page_size: limit,
    has_more: pr.has_more,
  };
}

export async function getArticle(accessToken: string, blogId: string, articleId: string) {
  const { ok, data } = await haravanJson<{ article?: { id: number; title: string; handle: string; body_html?: string } }>(
    `/web/blogs/${blogId}/articles/${articleId}.json`,
    accessToken,
  );
  if (!ok || !data?.article) return null;
  const a = data.article;
  return { id: String(a.id), title: a.title, handle: a.handle, body_html: a.body_html ?? '', blog_id: blogId };
}

export async function getPage(accessToken: string, pageId: string) {
  const { ok, data } = await haravanJson<{ page?: { id: number; title: string; handle: string; body_html?: string } }>(
    `/web/pages/${pageId}.json`,
    accessToken,
  );
  if (!ok || !data?.page) return null;
  const p = data.page;
  return { id: String(p.id), title: p.title, handle: p.handle, body_html: p.body_html ?? '' };
}

export async function getProductDetail(accessToken: string, productId: string) {
  const { ok, data } = await haravanJson<{ product?: unknown }>(`/com/products/${productId}.json`, accessToken);
  if (!ok || !data?.product) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = data.product as any;
  return {
    id: String(p.id),
    title: String(p.title ?? ''),
    handle: String(p.handle ?? ''),
    body_html: String(p.body_html ?? ''),
  };
}

export async function createScriptTag(accessToken: string, src: string): Promise<boolean> {
  const body = JSON.stringify({ script_tag: { event: 'onload', src, display_scope: 'all' } });
  const { ok, data } = await haravanJson<unknown>('/web/script_tags.json', accessToken, {
    method: 'POST',
    body,
  });
  if (!ok) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return d?.script_tag != null || d?.error === false;
}
