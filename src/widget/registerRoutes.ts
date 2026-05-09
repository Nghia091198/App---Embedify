import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import { listBlocksForContent, replaceBlocksForContent } from '../db/widgetBlocks.js';
import {
  getWidgetConfigParsed,
  getWidgetConfigRows,
  parseWidgetConfig,
  upsertWidgetConfig,
  WIDGET_CONFIG_DEFAULTS,
} from '../db/widgetConfig.js';
import type { HaravanRequest } from '../haravan/authMiddleware.js';
import { loadHaravanSession } from '../haravan/authMiddleware.js';
import { renderBlockHtml } from '../lib/blockRenderer.js';
import {
  createScriptTag,
  enrichSnapshots,
  fetchProductsByIds,
  getArticle,
  getPage,
  getProductDetail,
  listArticlesAggregated,
  listPagesContent,
  listProductsAsContent,
  listProductsPage,
  toProductSnapshots,
} from '../lib/haravanApi.js';
import type { ProductSnapshot, WidgetBlockInput, WidgetContentType } from '../types/widget.js';

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

function clampGridDesktop(n: number): 3 | 4 | 5 {
  if (n === 3 || n === 4 || n === 5) return n;
  return 4;
}

function clampGridMobile(n: number): 1 | 2 {
  if (n === 1 || n === 2) return n;
  return 2;
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
  if (!contentType || !contentId || !orgId) {
    res.status(400).json({ error: 'missing_params' });
    return;
  }
  try {
    const rows = await listBlocksForContent(orgId, contentType, contentId);
    const cfg = await getWidgetConfigParsed(orgId);
    const has_slider = rows.some((r) => r.display_type === 'slider');
    const blocks = rows.map((r) => ({
      position: r.position,
      display_type: r.display_type,
      slider_desktop_count: r.slider_desktop_count,
      slider_mobile_count: r.slider_mobile_count,
      html: renderBlockHtml({
        position: r.position,
        display_type: r.display_type,
        grid_desktop_cols: r.grid_desktop_cols,
        grid_mobile_cols: r.grid_mobile_cols,
        slider_desktop_count: r.slider_desktop_count,
        slider_mobile_count: r.slider_mobile_count,
        products: r.products_cache,
        enable_add_to_cart: cfg.enable_add_to_cart,
        enable_quick_view: cfg.enable_quick_view,
      }),
    }));
    res.json({ has_slider, blocks });
  } catch (e) {
    console.error(e);
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
    const base: WidgetBlockInput = {
      block_index: Number(b.block_index ?? i),
      title: typeof b.title === 'string' ? b.title : b.title == null ? null : String(b.title),
      position: typeof b.position === 'string' ? b.position : 'end',
      display_type,
      grid_desktop_cols: clampGridDesktop(Number(b.grid_desktop_cols ?? 4)),
      grid_mobile_cols: clampGridMobile(Number(b.grid_mobile_cols ?? 2)),
      slider_desktop_count: Number(b.slider_desktop_count ?? 4),
      slider_mobile_count: Number(b.slider_mobile_count ?? 1.5),
      product_ids,
    };
    const items = await fetchProductsByIds(token, product_ids);
    let snaps = toProductSnapshots(items);
    snaps = await enrichSnapshots(token, snaps);
    normalized.push({ ...base, products_cache: snaps });
  }
  const saved = await replaceBlocksForContent(orgId, contentType, contentId, normalized);
  res.json({ ok: true, blocks: saved });
}

async function adminGetConfig(req: HaravanRequest, res: Response): Promise<void> {
  const orgId = req.haravanSession?.orgid;
  if (!orgId) {
    res.status(403).json({ error: 'no_org' });
    return;
  }
  const rows = await getWidgetConfigRows(orgId);
  res.json({ config: { ...WIDGET_CONFIG_DEFAULTS, ...parseWidgetConfig(rows) }, raw: rows });
}

async function adminPostConfig(req: HaravanRequest, res: Response): Promise<void> {
  const orgId = req.haravanSession?.orgid;
  if (!orgId) {
    res.status(403).json({ error: 'no_org' });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const entries: Array<[string, string]> = [];
  if (typeof body.show_hidden_products === 'boolean') {
    entries.push(['show_hidden_products', body.show_hidden_products ? 'true' : 'false']);
  }
  if (body.max_blocks_per_content != null) {
    entries.push(['max_blocks_per_content', String(Math.max(1, Number(body.max_blocks_per_content)))]);
  }
  if (body.max_products_per_block != null) {
    entries.push(['max_products_per_block', String(Math.max(1, Number(body.max_products_per_block)))]);
  }
  if (typeof body.enable_add_to_cart === 'boolean') {
    entries.push(['enable_add_to_cart', body.enable_add_to_cart ? 'true' : 'false']);
  }
  if (typeof body.enable_quick_view === 'boolean') {
    entries.push(['enable_quick_view', body.enable_quick_view ? 'true' : 'false']);
  }
  for (const [k, v] of entries) {
    await upsertWidgetConfig(orgId, k, v);
  }
  const rows = await getWidgetConfigRows(orgId);
  res.json({ ok: true, config: parseWidgetConfig(rows) });
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
  const src = `${base.replace(/\/$/, '')}/widget-snippet.js`;
  const ok = await createScriptTag(token, src);
  res.json({ ok, src });
}

export function registerWidgetRoutes(app: express.Express): void {
  const json = express.json({ limit: '4mb' });

  app.get('/api/widget/blocks', corsWidgetPublic, (req, res, next) => {
    void getPublicBlocks(req, res).catch(next);
  });

  app.get('/api/admin/blocks/:contentType/:contentId', loadHaravanSession, asyncMw(adminGetBlocks));
  app.post('/api/admin/blocks', json, loadHaravanSession, asyncMw(adminPostBlocks));

  app.get('/api/admin/config', loadHaravanSession, asyncMw(adminGetConfig));
  app.post('/api/admin/config', json, loadHaravanSession, asyncMw(adminPostConfig));

  app.get('/api/admin/contents', loadHaravanSession, asyncMw(adminListContents));
  app.get('/api/admin/products', loadHaravanSession, asyncMw(adminListProducts));
  app.get('/api/admin/content-detail', loadHaravanSession, asyncMw(adminContentDetail));

  app.post('/api/admin/snippet/install', json, loadHaravanSession, asyncMw(adminSnippetInstall));
}
