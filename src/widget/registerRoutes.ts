import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import { storefrontCartAddProxy } from '../api/storefrontProxy.js';
import { listBlocksForContent, replaceBlocksForContent } from '../db/widgetBlocks.js';
import { getHaravanSessionByOrgId } from '../db/sessionStore.js';
import {
  getWidgetConfigParsed,
  getWidgetConfigRows,
  upsertWidgetConfig,
} from '../db/widgetConfig.js';
import type { HaravanRequest } from '../haravan/authMiddleware.js';
import { loadHaravanSession } from '../haravan/authMiddleware.js';
import { renderBlockHtml } from '../lib/blockRenderer.js';
import { logger } from '../lib/logger.js';
import { sanitizeThemeColorCss } from '../lib/themeColorSanitize.js';
import {
  createScriptTag,
  fetchProductSnapshotsByIds,
  getArticle,
  getPage,
  getProductDetail,
  pushWidgetBlocksToHaravanBody,
  purgeWidgetScriptTags,
  listArticlesAggregated,
  listPagesContent,
  listProductsAsContent,
  listProductsPage,
} from '../lib/haravanApi.js';
import type {
  ProductSnapshot,
  WidgetBlockInput,
  WidgetContentType,
  WidgetPublicRenderFlags,
} from '../types/widget.js';

function corsWidgetPublic(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (_req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

function parseContentType(s: string): WidgetContentType | null {
  if (s === 'article' || s === 'page' || s === 'product') return s;
  return null;
}

/** Khi `APP_ORIGIN` chưa set trên host (deploy), lấy URL public từ request để iframe `widget-frame.html` vẫn có `src` đúng. */
function inferPublicAppOrigin(req: Request): string {
  const xfHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = xfHost || req.get('host') || '';
  if (!host) return '';
  const xfProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto =
    xfProto === 'http' || xfProto === 'https' ? xfProto : (req.protocol === 'https' ? 'https' : 'http');
  return `${proto}://${host}`;
}

function clampGridDesktop(n: number): 2 | 3 | 4 | 5 {
  if (n === 2 || n === 3 || n === 4 || n === 5) return n;
  return 4;
}

function clampGapPx(n: number): number {
  if (!Number.isFinite(n)) return 12;
  return Math.min(48, Math.max(8, Math.round(n)));
}

function clampGridMobile(n: number): 1 | 2 {
  if (n === 1 || n === 2) return n;
  return 2;
}

/**
 * `shop_info` lưu lúc OAuth (`callback`) — dùng cho iframe widget-frame (origin = app):
 * href `/products/...` phải thành absolute storefront.
 */
async function productLinkBaseForOrg(orgId: string): Promise<string | null> {
  const row = await getHaravanSessionByOrgId(orgId);
  const info = row?.shop_info;
  if (!info || typeof info !== 'object') return null;
  const raw = (info as { shop_domain?: unknown }).shop_domain;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const host = raw.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  if (!host) return null;
  return `https://${host}`;
}

function publicFlags(
  cfg: Awaited<ReturnType<typeof getWidgetConfigParsed>>,
  productLinkBase: string | null,
): WidgetPublicRenderFlags {
  return {
    enable_add_to_cart: cfg.enable_add_to_cart,
    enable_quick_view: cfg.enable_quick_view,
    show_price: cfg.show_price,
    enable_contact: cfg.enable_contact,
    contact_label: cfg.contact_label,
    contact_url: cfg.contact_url,
    ...(productLinkBase ? { product_link_base: productLinkBase } : {}),
  };
}

function asyncMw(
  fn: (req: HaravanRequest, res: Response, next: NextFunction) => void | Promise<void>,
): (req: HaravanRequest, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

async function getPublicBlocks(req: Request, res: Response): Promise<void> {
  const contentType = parseContentType(String(req.query.content_type ?? ''));
  const contentId = String(req.query.content_id ?? '').trim();
  const orgId = String(req.query.org_id ?? '').trim();
  const biRaw = req.query.bi != null ? String(req.query.bi).trim() : '';
  if (!contentType || !contentId || !orgId) {
    res.status(400).json({ error: 'missing_params' });
    return;
  }
  try {
    logger.debug('serve blocks', {
      org_id: orgId,
      content_type: contentType,
      content_id: contentId,
    });
    const rowsAll = await listBlocksForContent(orgId, contentType, contentId);
    const cfg = await getWidgetConfigParsed(orgId);
    const plb = await productLinkBaseForOrg(orgId);
    /** Khi có `bi` (single-block iframe mode) → chỉ trả block đúng `block_index`. Iframe-per-block render đúng vị trí trong body. */
    const rows = biRaw !== '' && /^\d+$/.test(biRaw)
      ? rowsAll.filter((r) => r.block_index === parseInt(biRaw, 10))
      : rowsAll;
    const has_slider = rows.some((r) => r.display_type === 'slider');
    const rf = publicFlags(cfg, plb);
    const blocks = rows.map((r) => ({
      position: r.position,
      display_type: r.display_type,
      slider_desktop_count: r.slider_desktop_count,
      slider_mobile_count: r.slider_mobile_count,
      html: renderBlockHtml({
        block_title: r.title,
        position: r.position,
        display_type: r.display_type,
        grid_desktop_cols: r.grid_desktop_cols,
        grid_mobile_cols: r.grid_mobile_cols,
        grid_gap_px: r.grid_gap_px,
        slider_desktop_count: r.slider_desktop_count,
        slider_mobile_count: r.slider_mobile_count,
        products: r.products_cache,
        enable_add_to_cart: rf.enable_add_to_cart,
        enable_quick_view: rf.enable_quick_view,
        show_price: rf.show_price,
        enable_contact: rf.enable_contact,
        contact_label: rf.contact_label,
        contact_url: rf.contact_url,
        product_link_base: rf.product_link_base,
      }),
    }));
    /** Config phải có hiệu lực ngay khi merchant đổi → không cache. */
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      has_slider,
      blocks,
      config: {
        primary_color: cfg.primary_color,
        theme_page_bg: cfg.theme_page_bg,
        theme_page_text: cfg.theme_page_text,
        theme_title_text: cfg.theme_title_text,
        theme_border_color: cfg.theme_border_color,
        theme_button_color: cfg.theme_button_color,
        theme_link_hover_color: cfg.theme_link_hover_color,
        show_price: cfg.show_price,
        custom_css: cfg.custom_css,
        font_import_url: cfg.font_import_url,
        font_family: cfg.font_family,
        enable_contact: cfg.enable_contact,
        contact_label: cfg.contact_label,
        contact_url: cfg.contact_url,
        enable_add_to_cart: cfg.enable_add_to_cart,
        enable_quick_view: cfg.enable_quick_view,
      },
    });
  } catch (e) {
    logger.error('getPublicBlocks failed', {
      org_id: orgId,
      content_type: contentType,
      content_id: contentId,
      err: String(e),
    });
    res.status(503).json({ error: 'service_unavailable' });
  }
}

async function adminGetBlocks(req: HaravanRequest, res: Response): Promise<void> {
  const orgId = req.haravanSession?.orgid;
  if (!orgId) {
    res.status(403).json({ error: 'no_org' });
    return;
  }
  const contentType = parseContentType(String(req.params.contentType ?? ''));
  const contentId = String(req.params.contentId ?? '').trim();
  if (!contentType || !contentId) {
    res.status(400).json({ error: 'bad_params' });
    return;
  }
  const rows = await listBlocksForContent(orgId, contentType, contentId);
  res.json({ blocks: rows });
}

async function adminPostBlocks(req: HaravanRequest, res: Response): Promise<void> {
  const orgId = req.haravanSession?.orgid;
  const token = req.haravanSession?.access_token;
  if (!orgId || !token) {
    res.status(403).json({ error: 'no_org' });
    return;
  }
  const contentType = parseContentType(String(req.body?.content_type ?? ''));
  const contentId = String(req.body?.content_id ?? '').trim();
  const rawBlocks = Array.isArray(req.body?.blocks) ? req.body.blocks : null;
  if (!contentType || !contentId || !rawBlocks) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  const cfg = await getWidgetConfigParsed(orgId);
  if (rawBlocks.length > cfg.max_blocks_per_content) {
    res.status(400).json({ error: 'too_many_blocks' });
    return;
  }
  const normalized: Array<WidgetBlockInput & { products_cache: ProductSnapshot[] }> = [];
  for (let i = 0; i < rawBlocks.length; i++) {
    const b = rawBlocks[i] as Record<string, unknown>;
    const product_ids = Array.isArray(b.product_ids) ? b.product_ids.map(String) : [];
    if (product_ids.length > cfg.max_products_per_block) {
      res.status(400).json({ error: 'too_many_products' });
      return;
    }
    const display_type = b.display_type === 'slider' ? 'slider' : 'grid';
    const rawTitle = b.title;
    const titleTrimmed =
      typeof rawTitle === 'string'
        ? rawTitle.trim()
        : rawTitle == null
          ? ''
          : String(rawTitle).trim();
    const base: WidgetBlockInput = {
      block_index: Number(b.block_index ?? i),
      title: titleTrimmed.length > 0 ? titleTrimmed : null,
      position: typeof b.position === 'string' ? b.position : 'end',
      display_type,
      grid_desktop_cols: clampGridDesktop(Number(b.grid_desktop_cols ?? 4)),
      grid_mobile_cols: clampGridMobile(Number(b.grid_mobile_cols ?? 2)),
      grid_gap_px: clampGapPx(Number(b.grid_gap_px ?? 12)),
      slider_desktop_count: Number(b.slider_desktop_count ?? 4),
      slider_mobile_count: Number(b.slider_mobile_count ?? 1.5),
      product_ids,
    };
    const snaps = await fetchProductSnapshotsByIds(token, product_ids);
    normalized.push({ ...base, products_cache: snaps });
  }
  logger.info('save blocks', {
    org_id: orgId,
    content_type: contentType,
    content_id: contentId,
    block_count: normalized.length,
  });
  const saved = await replaceBlocksForContent(orgId, contentType, contentId, normalized);
  const blogId = String(req.body?.blog_id ?? '').trim();
  const touchHaravan = req.body?.touch_haravan !== false;
  let haravan_touched = false;
  let haravan_touch_error: string | undefined;
  let haravan_embed: {
    iframe_in_body: boolean;
    app_origin_source: 'env' | 'request' | 'none';
    app_origin_used: string;
  } | undefined;
  if (touchHaravan) {
    const fromEnv = process.env.APP_ORIGIN?.trim() ?? '';
    const inferred = inferPublicAppOrigin(req);
    const appOrigin = fromEnv || inferred;
    const app_origin_source: 'env' | 'request' | 'none' = fromEnv
      ? 'env'
      : inferred
        ? 'request'
        : 'none';
    if (!fromEnv && inferred) {
      logger.warn('APP_ORIGIN unset; iframe src uses request Host', {
        org_id: orgId,
        inferred_host: inferred,
      });
    }
    if (!appOrigin) {
      logger.warn('No APP_ORIGIN and could not infer Host — static HTML only, no iframe', { org_id: orgId });
    }
    haravan_embed = {
      iframe_in_body: saved.length > 0 && !!appOrigin,
      app_origin_source,
      app_origin_used: appOrigin,
    };
    const t = await pushWidgetBlocksToHaravanBody(
      token,
      contentType,
      contentId,
      contentType === 'article' ? blogId : undefined,
      saved,
      publicFlags(cfg, null),
      { appOrigin, orgId },
    );
    haravan_touched = t.ok;
    haravan_touch_error = t.ok ? undefined : t.message;
    if (!t.ok) {
      logger.warn('Haravan body push failed', { org_id: orgId, message: t.message });
    }
  }
  res.json({ ok: true, blocks: saved, haravan_touched, haravan_touch_error, haravan_embed });
}

async function adminGetConfig(req: HaravanRequest, res: Response): Promise<void> {
  const orgId = req.haravanSession?.orgid;
  if (!orgId) {
    res.status(403).json({ error: 'no_org' });
    return;
  }
  const [config, rows] = await Promise.all([getWidgetConfigParsed(orgId), getWidgetConfigRows(orgId)]);
  res.json({ config, raw: rows });
}

async function adminPostConfig(req: HaravanRequest, res: Response): Promise<void> {
  const orgId = req.haravanSession?.orgid;
  if (!orgId) {
    res.status(403).json({ error: 'no_org' });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const entries: Array<[string, string]> = [];
  if (typeof body.enable_add_to_cart === 'boolean') {
    entries.push(['enable_add_to_cart', body.enable_add_to_cart ? 'true' : 'false']);
  }
  if (typeof body.enable_quick_view === 'boolean') {
    entries.push(['enable_quick_view', body.enable_quick_view ? 'true' : 'false']);
  }
  if (typeof body.primary_color === 'string') {
    entries.push(['primary_color', body.primary_color.trim() || '#e84040']);
  }
  const themePush = (k: string, v: unknown) => {
    if (!(k in body)) return;
    if (typeof v !== 'string') return;
    const cleaned = sanitizeThemeColorCss(v);
    entries.push([k, cleaned]);
  };
  themePush('theme_page_bg', body.theme_page_bg);
  themePush('theme_page_text', body.theme_page_text);
  themePush('theme_title_text', body.theme_title_text);
  themePush('theme_border_color', body.theme_border_color);
  themePush('theme_button_color', body.theme_button_color);
  themePush('theme_link_hover_color', body.theme_link_hover_color);
  if (typeof body.show_price === 'boolean') {
    entries.push(['show_price', body.show_price ? 'true' : 'false']);
  }
  if (typeof body.enable_contact === 'boolean') {
    entries.push(['enable_contact', body.enable_contact ? 'true' : 'false']);
  }
  if (typeof body.contact_label === 'string') {
    entries.push(['contact_label', body.contact_label]);
  }
  if (typeof body.contact_url === 'string') {
    entries.push(['contact_url', body.contact_url]);
  }
  if (typeof body.custom_css === 'string') {
    entries.push(['custom_css', body.custom_css]);
  }
  if (typeof body.font_import_url === 'string') {
    entries.push(['font_import_url', body.font_import_url]);
  }
  if (typeof body.font_family === 'string') {
    entries.push(['font_family', body.font_family]);
  }
  for (const [k, v] of entries) {
    await upsertWidgetConfig(orgId, k, v);
  }
  const config = await getWidgetConfigParsed(orgId);
  res.json({ ok: true, config });
}

async function adminListContents(req: HaravanRequest, res: Response): Promise<void> {
  const orgId = req.haravanSession?.orgid;
  const token = req.haravanSession?.access_token;
  if (!orgId || !token) {
    res.status(403).json({ error: 'no_org' });
    return;
  }
  const type = String(req.query.type ?? 'article');
  const page = Math.max(1, Number(req.query.page ?? 1));
  const q = String(req.query.q ?? '');
  const cfg = await getWidgetConfigParsed(orgId);
  if (type === 'page') {
    const data = await listPagesContent(token, page, 20, q);
    res.json(data);
    return;
  }
  if (type === 'product') {
    const data = await listProductsAsContent(token, page, 20, q, cfg.show_hidden_products);
    if (!cfg.show_hidden_products) {
      data.items = data.items.filter((i) => i.published !== false);
    }
    res.json(data);
    return;
  }
  const data = await listArticlesAggregated(token, page, 20, q);
  res.json(data);
}

async function adminListProducts(req: HaravanRequest, res: Response): Promise<void> {
  const orgId = req.haravanSession?.orgid;
  const token = req.haravanSession?.access_token;
  if (!orgId || !token) {
    res.status(403).json({ error: 'no_org' });
    return;
  }
  const page = Math.max(1, Number(req.query.page ?? 1));
  const q = String(req.query.q ?? '');
  const cfg = await getWidgetConfigParsed(orgId);
  const data = await listProductsPage(token, page, 20, q);
  let items = data.items;
  if (!cfg.show_hidden_products) {
    items = items.filter((p) => p.published !== false);
  }
  res.json({ items, page: data.page, page_size: data.page_size, has_more: data.has_more });
}

async function adminProductSnapshots(req: HaravanRequest, res: Response): Promise<void> {
  const token = req.haravanSession?.access_token;
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const body = (req.body ?? {}) as { ids?: unknown };
  const raw = body.ids;
  const ids = Array.isArray(raw) ? raw.map((x) => String(x).trim()).filter(Boolean) : [];
  if (ids.length === 0) {
    res.status(400).json({ error: 'missing_ids' });
    return;
  }
  const max = 50;
  const snapshots = await fetchProductSnapshotsByIds(token, ids.slice(0, max));
  res.json({ snapshots });
}

async function adminContentDetail(req: HaravanRequest, res: Response): Promise<void> {
  const token = req.haravanSession?.access_token;
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const type = parseContentType(String(req.query.type ?? ''));
  const id = String(req.query.id ?? '').trim();
  const blogId = String(req.query.blog_id ?? '').trim();
  if (!type || !id) {
    res.status(400).json({ error: 'bad_params' });
    return;
  }
  if (type === 'article') {
    if (!blogId) {
      res.status(400).json({ error: 'blog_id_required' });
      return;
    }
    const a = await getArticle(token, blogId, id);
    res.json(a ?? null);
    return;
  }
  if (type === 'page') {
    const p = await getPage(token, id);
    res.json(p ?? null);
    return;
  }
  const p = await getProductDetail(token, id);
  res.json(p ?? null);
}

async function adminSnippetInstall(req: HaravanRequest, res: Response): Promise<void> {
  const token = req.haravanSession?.access_token;
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const origin = process.env.APP_ORIGIN?.trim();
  const host = req.get('host');
  const proto = req.protocol;
  const base = origin || (host ? `${proto}://${host}` : '');
  if (!base) {
    res.status(500).json({ error: 'APP_ORIGIN_missing' });
    return;
  }
  const root = base.replace(/\/$/, '');
  /**
   * ScriptTag: URL **cố định**, không có `?v=timestamp`.
   * Tất cả update qua `Cache-Control: max-age=300` ở static handler — shop tự nhận
   * version mới sau ≤5 phút, không cần merchant Cài lại snippet.
   */
  const snippetSrc = `${root}/widget-snippet.js`;
  /** Xoá hết script_tag cũ (kể cả URL có `?v=...` từ version trước, và `widget-embed-resize.js` cũ). */
  const purged = await purgeWidgetScriptTags(token, root);
  const snippetOk = await createScriptTag(token, snippetSrc);
  res.json({
    ok: snippetOk,
    purged,
    snippet_ok: snippetOk,
    snippet_src: snippetSrc,
    /** @deprecated dùng snippet_src */
    src: snippetSrc,
  });
}

export function registerWidgetRoutes(app: express.Express): void {
  const json = express.json({ limit: '4mb' });

  app.get('/api/widget/blocks', corsWidgetPublic, (req, res, next) => {
    void getPublicBlocks(req, res).catch(next);
  });

  /** Public proxy: iframe (app domain) → app server → Haravan storefront /cart/add.js — bypass cross-origin. */
  app.options('/api/storefront/cart-add', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
  });
  app.post(
    '/api/storefront/cart-add',
    express.json({ limit: '64kb' }),
    (req, res, next) => {
      void storefrontCartAddProxy(req, res).catch(next);
    },
  );

  app.get('/api/admin/blocks/:contentType/:contentId', loadHaravanSession, asyncMw(adminGetBlocks));
  app.post('/api/admin/blocks', json, loadHaravanSession, asyncMw(adminPostBlocks));

  app.get('/api/admin/config', loadHaravanSession, asyncMw(adminGetConfig));
  app.post('/api/admin/config', json, loadHaravanSession, asyncMw(adminPostConfig));

  app.get('/api/admin/contents', loadHaravanSession, asyncMw(adminListContents));
  app.get('/api/admin/products', loadHaravanSession, asyncMw(adminListProducts));
  app.post('/api/admin/product-snapshots', json, loadHaravanSession, asyncMw(adminProductSnapshots));
  app.get('/api/admin/content-detail', loadHaravanSession, asyncMw(adminContentDetail));

  app.post('/api/admin/snippet/install', json, loadHaravanSession, asyncMw(adminSnippetInstall));
}
