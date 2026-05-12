import type {
  AdminContentListItem,
  AdminContentsResponse,
  AdminProductsResponse,
  ProductImage,
  ProductSnapshot,
  ProductVariant,
  WidgetBlockRow,
  WidgetContentType,
  WidgetPublicRenderFlags,
} from '../types/widget.js';
import { mergeHaravanBodyWithStaticBlocksAndWidgetFrame } from './mergeBodyForHaravan.js';

const API = 'https://apis.haravan.com';

export async function haravanJson<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null; rawText: string }> {
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
  return { ok: res.ok, status: res.status, data, rawText: text };
}

function haravanErrorHint(rawText: string, status: number): string {
  const t = rawText.replace(/\s+/g, ' ').trim().slice(0, 400);
  return t || `http_${status}`;
}

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function formatMoney(amount: string | number | null | undefined, currency = '₫'): string {
  if (amount == null || amount === '') return '';
  const n = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
  if (Number.isNaN(n)) return String(amount);
  return `${new Intl.NumberFormat('vi-VN').format(n)} ${currency}`.trim();
}

function formatMoneyOrNull(v: number | null): string | null {
  if (v == null) return null;
  return formatMoney(v);
}

function stripHtml(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapImage(img: any): ProductImage | null {
  if (!img) return null;
  const src = typeof img === 'string' ? img : img?.src;
  if (typeof src !== 'string' || !src.trim()) return null;
  return {
    id: img?.id != null ? String(img.id) : null,
    src: src.trim(),
    alt: img?.alt != null ? String(img.alt) : null,
    position: img?.position != null ? Number(img.position) : null,
    width: img?.width != null ? Number(img.width) : null,
    height: img?.height != null ? Number(img.height) : null,
    variant_ids: Array.isArray(img?.variant_ids) ? img.variant_ids.map(String) : [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapVariant(v: any): ProductVariant {
  const price = toNumber(v?.price);
  const compare = toNumber(v?.compare_at_price);
  const inv = v?.inventory_quantity;
  const invNum = typeof inv === 'number' ? inv : toNumber(inv);
  const available =
    v?.available === true ||
    (typeof invNum === 'number' && invNum > 0) ||
    v?.inventory_management == null;
  return {
    id: String(v?.id ?? ''),
    product_id: v?.product_id != null ? String(v.product_id) : null,
    title: String(v?.title ?? ''),
    option1: v?.option1 != null ? String(v.option1) : null,
    option2: v?.option2 != null ? String(v.option2) : null,
    option3: v?.option3 != null ? String(v.option3) : null,
    sku: v?.sku != null && String(v.sku).trim() ? String(v.sku) : null,
    barcode: v?.barcode != null && String(v.barcode).trim() ? String(v.barcode) : null,
    price,
    compare_at_price: compare,
    formatted_price: formatMoneyOrNull(price),
    formatted_compare_at_price: formatMoneyOrNull(compare),
    available: Boolean(available),
    inventory_quantity: invNum,
    inventory_management: v?.inventory_management != null ? String(v.inventory_management) : null,
    inventory_policy: v?.inventory_policy != null ? String(v.inventory_policy) : null,
    requires_shipping: v?.requires_shipping !== false,
    taxable: v?.taxable !== false,
    weight: toNumber(v?.weight),
    weight_unit: v?.weight_unit != null ? String(v.weight_unit) : null,
    grams: toNumber(v?.grams),
    position: v?.position != null ? Number(v.position) : null,
    featured_image: mapImage(v?.featured_image ?? v?.image),
  };
}

/**
 * Map full Haravan admin product JSON (`/com/products/:id.json` → `data.product`)
 * sang ProductSnapshot có shape gần với storefront `product.js`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function productAdminJsonToSnapshot(p: any): ProductSnapshot {
  const variants: ProductVariant[] = Array.isArray(p?.variants) ? p.variants.map(mapVariant) : [];
  const images: ProductImage[] = Array.isArray(p?.images)
    ? p.images.map(mapImage).filter((x: ProductImage | null): x is ProductImage => x != null)
    : [];
  const featured =
    mapImage(p?.image)?.src ??
    (images[0]?.src ?? null);

  const prices = variants.map((v) => v.price).filter((x): x is number => x != null);
  const compares = variants.map((v) => v.compare_at_price).filter((x): x is number => x != null);
  const price = prices.length ? Math.min(...prices) : null;
  const price_min = prices.length ? Math.min(...prices) : null;
  const price_max = prices.length ? Math.max(...prices) : null;
  const price_varies = price_min != null && price_max != null && price_min !== price_max;
  const compare_at_price = compares.length ? Math.max(...compares) : null;
  const compare_at_price_min = compares.length ? Math.min(...compares) : null;
  const compare_at_price_max = compares.length ? Math.max(...compares) : null;
  const compare_at_price_varies =
    compare_at_price_min != null && compare_at_price_max != null && compare_at_price_min !== compare_at_price_max;

  const available =
    p?.available === true ||
    variants.some((v) => v.available) ||
    p?.published_scope === 'global';

  const published_at = p?.published_at != null ? String(p.published_at) : null;
  const status = typeof p?.status === 'string' ? p.status : null;
  const published = p?.published === false ? false : Boolean(published_at) && status !== 'draft';

  const handle = String(p?.handle ?? '');
  const apiPathRaw =
    p?.url != null && String(p.url).trim()
      ? String(p.url).trim()
      : p?.link != null && String(p.link).trim()
        ? String(p.link).trim()
        : '';
  const url =
    apiPathRaw !== ''
      ? apiPathRaw.startsWith('/') || /^https?:\/\//i.test(apiPathRaw)
        ? apiPathRaw
        : `/${apiPathRaw}`
      : handle
        ? `/products/${handle}`
        : '';
  const optionNames: string[] = Array.isArray(p?.options)
    ? p.options
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((o: any) => (typeof o === 'string' ? o : String(o?.name ?? '').trim()))
        .filter(Boolean)
    : [];

  return {
    id: String(p?.id ?? ''),
    title: String(p?.title ?? ''),
    handle,
    url,
    description: stripHtml(p?.body_html),
    body_html: typeof p?.body_html === 'string' ? p.body_html : null,
    vendor: p?.vendor != null ? String(p.vendor) : null,
    type: p?.product_type != null ? String(p.product_type) : p?.type != null ? String(p.type) : null,
    tags: parseTags(p?.tags),
    options: optionNames,
    price,
    price_min,
    price_max,
    price_varies,
    compare_at_price,
    compare_at_price_min,
    compare_at_price_max,
    compare_at_price_varies,
    formatted_price: formatMoneyOrNull(price),
    formatted_compare_at_price: formatMoneyOrNull(compare_at_price),
    available: Boolean(available),
    published,
    published_at,
    created_at: p?.created_at != null ? String(p.created_at) : null,
    updated_at: p?.updated_at != null ? String(p.updated_at) : null,
    featured_image: featured,
    images,
    variants,
    sku: variants[0]?.sku ?? null,
  };
}

/** Ảnh đại diện từ object list Haravan (article / page / …). */
function pickHaravanListImage(row: unknown): string | null {
  if (row == null || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const img = r.image;
  if (typeof img === 'string' && img.trim()) return img.trim();
  if (img && typeof img === 'object' && 'src' in img) {
    const s = (img as { src?: unknown }).src;
    if (typeof s === 'string' && s.trim()) return s.trim();
  }
  if (typeof r.thumbnail === 'string' && r.thumbnail.trim()) return r.thumbnail.trim();
  if (typeof r.featured_image === 'string' && r.featured_image.trim()) return r.featured_image.trim();
  const fm = r.featured_media;
  if (fm && typeof fm === 'object' && 'src' in fm) {
    const s = (fm as { src?: unknown }).src;
    if (typeof s === 'string' && s.trim()) return s.trim();
  }
  const images = r.images;
  if (Array.isArray(images) && images[0] && typeof images[0] === 'object') {
    const src = (images[0] as { src?: unknown }).src;
    if (typeof src === 'string' && src.trim()) return src.trim();
  }
  return null;
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

const PRODUCT_LIST_FIELDS = 'id,title,handle,variants,images,image,published,published_at,available';
/** Haravan thường trả ~50/trang; dùng 50 để phân biệt “trang đầy” vs hết catalog (tránh dừng sớm khi server cắt limit). */
const PRODUCT_SEARCH_BATCH = 50;
const PRODUCT_SEARCH_MAX_API_PAGES = 200;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function productRawMatchesQuery(p: any, qq: string): boolean {
  if (String(p?.title ?? '')
    .toLowerCase()
    .includes(qq)) {
    return true;
  }
  if (String(p?.handle ?? '')
    .toLowerCase()
    .includes(qq)) {
    return true;
  }
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  for (const v of variants) {
    const sku = v?.sku != null ? String(v.sku).toLowerCase() : '';
    if (sku && sku.includes(qq)) return true;
  }
  return false;
}

async function fetchHaravanProductsJsonPage(
  accessToken: string,
  apiPage: number,
  batchLimit: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const qs = new URLSearchParams();
  qs.set('page', String(apiPage));
  qs.set('limit', String(batchLimit));
  qs.set('fields', PRODUCT_LIST_FIELDS);
  const { ok, data } = await haravanJson<{ products?: unknown[] }>(
    `/com/products.json?${qs.toString()}`,
    accessToken,
  );
  if (!ok || !data?.products) return [];
  return data.products as any[];
}

async function fetchHaravanProductSummariesBatch(
  accessToken: string,
  apiPage: number,
  batchLimit: number,
): Promise<{ items: AdminContentListItem[]; rawCount: number }> {
  const raw = await fetchHaravanProductsJsonPage(accessToken, apiPage, batchLimit);
  return { items: raw.map(mapProductSummary), rawCount: raw.length };
}

export async function listProductsPage(
  accessToken: string,
  page: number,
  limit: number,
  q: string,
): Promise<AdminProductsResponse> {
  const qq = q.trim().toLowerCase();

  if (!qq) {
    const { items, rawCount } = await fetchHaravanProductSummariesBatch(accessToken, page, limit);
    return {
      items,
      page,
      page_size: limit,
      has_more: rawCount >= limit,
    };
  }

  const matches: AdminContentListItem[] = [];
  for (let apiPage = 1; apiPage <= PRODUCT_SEARCH_MAX_API_PAGES; apiPage += 1) {
    const raw = await fetchHaravanProductsJsonPage(accessToken, apiPage, PRODUCT_SEARCH_BATCH);
    if (raw.length === 0) break;
    for (const row of raw) {
      if (productRawMatchesQuery(row, qq)) matches.push(mapProductSummary(row));
    }
    if (raw.length < PRODUCT_SEARCH_BATCH) break;
  }

  const start = (page - 1) * limit;
  return {
    items: matches.slice(start, start + limit),
    page,
    page_size: limit,
    has_more: matches.length > start + limit,
  };
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

/**
 * Tạo ProductSnapshot tối thiểu từ list-item (chưa có variants/images chi tiết).
 * Dùng cho UI optimistic — server sẽ thay bằng snapshot full khi save.
 */
export function toProductSnapshots(items: AdminContentListItem[]): ProductSnapshot[] {
  return items.map((p) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    url: p.handle ? `/products/${p.handle}` : '',
    description: '',
    body_html: null,
    vendor: null,
    type: null,
    tags: [],
    options: [],
    price: null,
    price_min: null,
    price_max: null,
    price_varies: false,
    compare_at_price: null,
    compare_at_price_min: null,
    compare_at_price_max: null,
    compare_at_price_varies: false,
    formatted_price: p.price ?? null,
    formatted_compare_at_price: null,
    available: p.available ?? true,
    published: p.published ?? true,
    published_at: null,
    created_at: null,
    updated_at: null,
    featured_image: p.thumbnail ?? null,
    images: [],
    variants: [],
    sku: p.sku ?? null,
  }));
}

/** Lấy ProductSnapshot full từ admin API theo id (1 GET / id). */
export async function fetchProductSnapshotsByIds(
  accessToken: string,
  ids: string[],
): Promise<ProductSnapshot[]> {
  const uniq = [...new Set(ids)].filter(Boolean);
  const out: ProductSnapshot[] = [];
  for (const id of uniq) {
    const { ok, data } = await haravanJson<{ product?: unknown }>(`/com/products/${id}.json`, accessToken);
    if (ok && data?.product) {
      out.push(productAdminJsonToSnapshot(data.product));
    }
  }
  return out;
}

/** Refresh snapshots cũ thành full snapshot (đọc admin product detail). */
export async function enrichSnapshots(
  accessToken: string,
  snapshots: ProductSnapshot[],
): Promise<ProductSnapshot[]> {
  const ids = snapshots.map((s) => s.id);
  const fresh = await fetchProductSnapshotsByIds(accessToken, ids);
  const byId = new Map(fresh.map((s) => [s.id, s]));
  return snapshots.map((s) => byId.get(s.id) ?? s);
}

const PAGES_SEARCH_BATCH = 50;
const PAGES_SEARCH_MAX_API_PAGES = 100;

async function fetchHaravanPagesBatch(
  accessToken: string,
  apiPage: number,
  batchLimit: number,
): Promise<{ items: AdminContentListItem[]; rawCount: number }> {
  const qs = new URLSearchParams();
  qs.set('page', String(apiPage));
  qs.set('limit', String(batchLimit));
  qs.set('published_status', 'any');
  const { ok, data } = await haravanJson<{ pages?: Record<string, unknown>[] }>(
    `/web/pages.json?${qs.toString()}`,
    accessToken,
  );
  if (!ok || !data?.pages) return { items: [], rawCount: 0 };
  const items: AdminContentListItem[] = data.pages.map((p) => {
    const thumb = pickHaravanListImage(p);
    return {
      id: String(p.id),
      title: String(p.title ?? ''),
      handle: String(p.handle ?? ''),
      thumbnail: thumb ?? undefined,
    };
  });
  return { items, rawCount: data.pages.length };
}

export async function listPagesContent(
  accessToken: string,
  page: number,
  limit: number,
  q: string,
): Promise<AdminContentsResponse> {
  const qq = q.trim().toLowerCase();

  if (!qq) {
    const { items, rawCount } = await fetchHaravanPagesBatch(accessToken, page, limit);
    return {
      items,
      page,
      page_size: limit,
      has_more: rawCount >= limit,
    };
  }

  const matches: AdminContentListItem[] = [];
  for (let apiPage = 1; apiPage <= PAGES_SEARCH_MAX_API_PAGES; apiPage += 1) {
    const { items, rawCount } = await fetchHaravanPagesBatch(accessToken, apiPage, PAGES_SEARCH_BATCH);
    if (rawCount === 0) break;
    for (const it of items) {
      if (it.title.toLowerCase().includes(qq) || it.handle.toLowerCase().includes(qq)) {
        matches.push(it);
      }
    }
    if (rawCount < PAGES_SEARCH_BATCH) break;
  }

  const start = (page - 1) * limit;
  return {
    items: matches.slice(start, start + limit),
    page,
    page_size: limit,
    has_more: matches.length > start + limit,
  };
}

export async function listArticlesAggregated(
  accessToken: string,
  page: number,
  limit: number,
  q: string,
): Promise<AdminContentsResponse> {
  const { ok, data } = await haravanJson<{ blogs?: { id: number; handle: string }[] }>(
    `/web/blogs.json?limit=250`,
    accessToken,
  );
  if (!ok || !data?.blogs) return { items: [], page, page_size: limit, has_more: false };

  type Art = {
    id: number;
    title: string;
    handle: string;
    blog_id: number;
    blog_handle: string;
    body_html?: string;
    updated_at?: string;
  };
  const all: Art[] = [];
  for (const b of data.blogs) {
    const blogHandle = String(b.handle ?? '');
    const r = await haravanJson<{ articles?: Omit<Art, 'blog_id' | 'blog_handle'>[] }>(
      `/web/blogs/${b.id}/articles.json?limit=250&page=1&published_status=any`,
      accessToken,
    );
    if (r.ok && r.data?.articles) {
      for (const a of r.data.articles) {
        all.push({ ...a, blog_id: b.id, blog_handle: blogHandle });
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
    blog_handle: a.blog_handle,
    thumbnail: pickHaravanListImage(a) ?? undefined,
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
      thumbnail: p.thumbnail,
    })),
    page,
    page_size: limit,
    has_more: pr.has_more,
  };
}

export async function getArticle(accessToken: string, blogId: string, articleId: string) {
  const [ar, br] = await Promise.all([
    haravanJson<{
      article?: { id: number; title: string; handle: string; body_html?: string; author?: string; tags?: string };
    }>(`/web/blogs/${blogId}/articles/${articleId}.json`, accessToken),
    haravanJson<{ blog?: { handle?: string } }>(`/web/blogs/${blogId}.json`, accessToken),
  ]);
  if (!ar.ok || !ar.data?.article) return null;
  const a = ar.data.article;
  const blog_handle = br.ok && br.data?.blog?.handle ? String(br.data.blog.handle) : '';
  return {
    id: String(a.id),
    title: a.title,
    handle: a.handle,
    body_html: a.body_html ?? '',
    blog_id: blogId,
    blog_handle,
  };
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

/**
 * Host storefront (không gồm protocol) để ghép `https://{host}/{link}`.
 * Haravan: `domain` = domain website bán hàng; `myharavan_domain` = subdomain haravan.
 * Ưu tiên `domain` để khớp link sản phẩm trên web thực tế.
 */
export async function getShopDomain(accessToken: string): Promise<string | null> {
  const { ok, data } = await haravanJson<{
    shop?: { myharavan_domain?: string; domain?: string };
  }>('/com/shop.json', accessToken);
  if (!ok || !data?.shop) return null;
  const raw = data.shop.domain ?? data.shop.myharavan_domain ?? null;
  if (raw == null) return null;
  const s = String(raw).trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  return s || null;
}

/**
 * Đẩy block lên Haravan: có APP_ORIGIN → body chỉ iframe widget-frame; không có → chỉ HTML tĩnh (wg:widget-blocks).
 */
export async function pushWidgetBlocksToHaravanBody(
  accessToken: string,
  type: WidgetContentType,
  id: string,
  blogId: string | undefined,
  blocks: WidgetBlockRow[],
  flags: WidgetPublicRenderFlags,
  embed: { appOrigin: string; orgId: string },
): Promise<{ ok: boolean; message?: string }> {
  try {
    if (type === 'page') {
      const r = await haravanJson<{ page?: Record<string, unknown> }>(`/web/pages/${id}.json`, accessToken);
      if (!r.ok || !r.data?.page) {
        return { ok: false, message: `get_page_failed:${r.status}:${haravanErrorHint(r.rawText, r.status)}` };
      }
      const page = r.data.page;
      const merged = mergeHaravanBodyWithStaticBlocksAndWidgetFrame(String(page.body_html ?? ''), blocks, {
        flags,
        appOrigin: embed.appOrigin,
        orgId: embed.orgId,
        contentType: type,
        contentId: id,
      });
      const put = await haravanJson(`/web/pages/${id}.json`, accessToken, {
        method: 'PUT',
        body: JSON.stringify({ page: { ...page, body_html: merged } }),
      });
      if (!put.ok) {
        return { ok: false, message: `put_page_failed:${put.status}:${haravanErrorHint(put.rawText, put.status)}` };
      }
      return { ok: true };
    }
    if (type === 'article') {
      if (!blogId) return { ok: false, message: 'blog_id_required' };
      const r = await haravanJson<{ article?: Record<string, unknown> }>(
        `/web/blogs/${blogId}/articles/${id}.json`,
        accessToken,
      );
      if (!r.ok || !r.data?.article) {
        return { ok: false, message: `get_article_failed:${r.status}:${haravanErrorHint(r.rawText, r.status)}` };
      }
      const a = r.data.article;
      const merged = mergeHaravanBodyWithStaticBlocksAndWidgetFrame(String(a.body_html ?? ''), blocks, {
        flags,
        appOrigin: embed.appOrigin,
        orgId: embed.orgId,
        contentType: type,
        contentId: id,
      });
      const put = await haravanJson(`/web/blogs/${blogId}/articles/${id}.json`, accessToken, {
        method: 'PUT',
        body: JSON.stringify({ article: { ...a, body_html: merged } }),
      });
      if (!put.ok) {
        return { ok: false, message: `put_article_failed:${put.status}:${haravanErrorHint(put.rawText, put.status)}` };
      }
      return { ok: true };
    }
    if (type === 'product') {
      const r = await haravanJson<{ product?: Record<string, unknown> }>(`/com/products/${id}.json`, accessToken);
      if (!r.ok || !r.data?.product) {
        return { ok: false, message: `get_product_failed:${r.status}:${haravanErrorHint(r.rawText, r.status)}` };
      }
      const p = r.data.product;
      const merged = mergeHaravanBodyWithStaticBlocksAndWidgetFrame(String(p.body_html ?? ''), blocks, {
        flags,
        appOrigin: embed.appOrigin,
        orgId: embed.orgId,
        contentType: type,
        contentId: id,
      });
      const put = await haravanJson(`/com/products/${id}.json`, accessToken, {
        method: 'PUT',
        body: JSON.stringify({ product: { ...p, body_html: merged } }),
      });
      if (!put.ok) {
        return { ok: false, message: `put_product_failed:${put.status}:${haravanErrorHint(put.rawText, put.status)}` };
      }
      return { ok: true };
    }
  } catch {
    return { ok: false, message: 'exception' };
  }
  return { ok: false, message: 'unsupported' };
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

export async function listScriptTags(
  accessToken: string,
): Promise<Array<{ id: number; src: string }>> {
  const { ok, data } = await haravanJson<{ script_tags?: Array<{ id: number; src: string }> }>(
    '/web/script_tags.json?limit=250',
    accessToken,
  );
  if (!ok || !data?.script_tags) return [];
  return data.script_tags;
}

export async function deleteScriptTag(accessToken: string, id: number): Promise<boolean> {
  const { ok } = await haravanJson<unknown>(`/web/script_tags/${id}.json`, accessToken, {
    method: 'DELETE',
  });
  return ok;
}

/**
 * Xoá mọi script_tag cũ có URL bắt đầu bằng `${appOrigin}/widget-snippet.js` hoặc `/widget-embed-resize.js`
 * (kể cả có query `?v=...`) để khi tạo mới không bị duplicate listener nạp đoạn code cũ đã cache.
 */
export async function purgeWidgetScriptTags(accessToken: string, appOrigin: string): Promise<number> {
  const root = appOrigin.replace(/\/$/, '');
  const tags = await listScriptTags(accessToken);
  const targets = tags.filter((t) => {
    const s = t.src || '';
    return (
      s.startsWith(`${root}/widget-snippet.js`) ||
      s.startsWith(`${root}/widget-embed-resize.js`)
    );
  });
  let deleted = 0;
  for (const t of targets) {
    if (await deleteScriptTag(accessToken, t.id)) deleted++;
  }
  return deleted;
}
