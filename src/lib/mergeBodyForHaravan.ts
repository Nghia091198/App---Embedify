import { renderBlockHtml } from './blockRenderer.js';
import type { WidgetBlockRow, WidgetContentType, WidgetPublicRenderFlags } from '../types/widget.js';

/** HTML tĩnh (markup card/grid/slider) — Haravan lưu trong body. */
export const WG_WIDGET_START = '<!--wg:widget-blocks-->';
export const WG_WIDGET_END = '<!--/wg:widget-blocks-->';

/** Iframe tới app: load CSS/JS (Swiper) + render block qua API — chạy độc lập với theme. */
export const WG_IFRAME_START = '<!--wg:iframe-widget-->';
export const WG_IFRAME_END = '<!--/wg:iframe-widget-->';

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');
}

function stripByMarkers(html: string, start: string, end: string): string {
  const re = new RegExp(
    `${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`,
    'g',
  );
  return html.replace(re, '').trimEnd();
}

function positionRank(position: string): number {
  if (position === 'start') return 0;
  if (position === 'end') return 2;
  if (typeof position === 'string' && position.indexOf('after_p_') === 0) return 1;
  return 2;
}

function afterIndex(position: string): number {
  if (typeof position !== 'string' || position.indexOf('after_p_') !== 0) return Number.MAX_SAFE_INTEGER;
  const n = parseInt(position.replace('after_p_', ''), 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

export function sortBlocksForHaravanMerge(blocks: WidgetBlockRow[]): WidgetBlockRow[] {
  return blocks
    .slice()
    .sort((a, b) => {
      const ra = positionRank(a.position);
      const rb = positionRank(b.position);
      if (ra !== rb) return ra - rb;
      if (ra === 1) {
        const da = afterIndex(a.position);
        const db = afterIndex(b.position);
        if (da !== db) return da - db;
      }
      return (a.block_index ?? 0) - (b.block_index ?? 0);
    })
    .reverse();
}

export function stripWidgetBlocksSection(html: string): string {
  return stripByMarkers(html, WG_WIDGET_START, WG_WIDGET_END);
}

export function stripIframeWidgetSection(html: string): string {
  /**
   * Strip cả 3 format:
   *   1. Old: `<!--wg:iframe-widget-->...<!--/wg:iframe-widget-->`
   *   2. Bug-format (suffix ngoài comment): `<!--wg:iframe-widget-->:N...<!--/wg:iframe-widget-->:N`
   *   3. New: `<!--wg:iframe-widget:N-->...<!--/wg:iframe-widget:N-->`
   */
  let out = html ?? '';
  // Format 3 (new)
  out = out.replace(/<!--wg:iframe-widget:\d+-->[\s\S]*?<!--\/wg:iframe-widget:\d+-->\s*/g, '');
  // Format 1 + 2 (old + bug)
  out = out.replace(/<!--wg:iframe-widget-->(?::\d+)?[\s\S]*?<!--\/wg:iframe-widget-->(?::\d+)?\s*/g, '');
  return out.trimEnd();
}

/** Xóa cả hai vùng do lần push trước (tĩnh + iframe). */
export function stripAllHaravanWidgetSections(html: string): string {
  let out = stripWidgetBlocksSection(html ?? '');
  out = stripIframeWidgetSection(out);
  return out;
}

function buildInlineWidgetHtml(blocks: WidgetBlockRow[], flags: WidgetPublicRenderFlags): string {
  const sorted = sortBlocksForHaravanMerge(blocks);
  const parts = sorted.map((b) =>
    renderBlockHtml({
      block_title: b.title,
      position: b.position,
      display_type: b.display_type,
      grid_desktop_cols: b.grid_desktop_cols,
      grid_mobile_cols: b.grid_mobile_cols,
      grid_gap_px: b.grid_gap_px,
      slider_desktop_count: b.slider_desktop_count,
      slider_mobile_count: b.slider_mobile_count,
      products: b.products_cache,
      enable_add_to_cart: flags.enable_add_to_cart,
      enable_quick_view: flags.enable_quick_view,
      show_price: flags.show_price,
      enable_contact: flags.enable_contact,
      contact_label: flags.contact_label,
      contact_url: flags.contact_url,
      product_link_base: flags.product_link_base,
    }),
  );
  return `${WG_WIDGET_START}\n${parts.join('\n')}\n${WG_WIDGET_END}`;
}

/**
 * Iframe thật trong body — storefront load widget ngay, không phụ thuộc snippet.
 * Wrapper: `contenteditable="false"` + TinyMCE `mceNonEditable` / `data-mce-contenteditable` để admin Haravan hạn chế sửa nhầm.
 */
function buildIframeEmbedMarkup(
  appOrigin: string,
  orgId: string,
  contentType: WidgetContentType,
  contentId: string,
  blockIndex: number,
): string {
  const baseUrl = appOrigin.trim().replace(/\/$/, '');
  if (!baseUrl) return '';
  const params = new URLSearchParams({
    app: baseUrl,
    ct: contentType,
    cid: contentId,
    org: orgId,
    bi: String(blockIndex),
  });
  const src = `${baseUrl}/widget-frame.html?${params.toString()}`;
  const iframeHtml =
    `<div class="wg-haravan-widget-frame mceNonEditable" contenteditable="false" data-mce-contenteditable="false" data-wg-embed="iframe" data-block-index="${blockIndex}">` +
    `<iframe class="wg-haravan-widget-iframe" src="${escapeHtmlAttr(src)}" title="Widget block sản phẩm" loading="lazy" scrolling="no" ` +
    `referrerpolicy="strict-origin-when-cross-origin" ` +
    `style="width:100%;max-width:100%;border:0;display:block;min-height:200px;overflow:hidden;transition:height 0.2s ease"></iframe>` +
    `</div>`;
  /**
   * Marker đặt block_index TRONG comment (`<!--wg:iframe-widget:N-->`) — nếu để ngoài (`-->:N`)
   * thì `:N` thành text hiển thị trên storefront (HTML comment đã đóng).
   */
  const startTag = `<!--wg:iframe-widget:${blockIndex}-->`;
  const endTag = `<!--/wg:iframe-widget:${blockIndex}-->`;
  return `${startTag}\n${iframeHtml}\n${endTag}`;
}

/**
 * Chèn `content` vào `html` tại vị trí `position` (`start` | `end` | `after_p_N`).
 * `after_p_N` = sau thẻ `</p>` thứ N (1-indexed). Không tìm thấy → append cuối.
 */
function insertAtPosition(html: string, position: string, content: string): string {
  if (position === 'start') return `${content}\n${html}`;
  if (position === 'end' || !position) return `${html}\n${content}`;
  if (position.indexOf('after_p_') === 0) {
    const n = parseInt(position.replace('after_p_', ''), 10);
    if (!Number.isFinite(n) || n < 1) return `${html}\n${content}`;
    const re = /<\/p\s*>/gi;
    let count = 0;
    let m: RegExpExecArray | null;
    let insertAt = -1;
    while ((m = re.exec(html)) !== null) {
      count++;
      if (count === n) {
        insertAt = m.index + m[0].length;
        break;
      }
    }
    if (insertAt === -1) return `${html}\n${content}`;
    return `${html.slice(0, insertAt)}\n${content}\n${html.slice(insertAt)}`;
  }
  return `${html}\n${content}`;
}

/**
 * Body Haravan sau khi lưu:
 * - Có `appOrigin` (HTTPS production): **mỗi block = 1 iframe** chèn vào đúng vị trí (`start` / `after_p_N` / `end`).
 *   Iframe nhận param `bi=N` → `getPublicBlocks` chỉ trả 1 block tương ứng. Storefront hiển thị trực tiếp trong iframe (không dùng placeholder + hydrate).
 * - Không có origin: HTML tĩnh `wg:widget-blocks` ở cuối body (fallback).
 */
export function mergeHaravanBodyWithStaticBlocksAndWidgetFrame(
  bodyHtml: string,
  blocks: WidgetBlockRow[],
  opts: {
    flags: WidgetPublicRenderFlags;
    appOrigin: string;
    orgId: string;
    contentType: WidgetContentType;
    contentId: string;
  },
): string {
  const base = stripAllHaravanWidgetSections(bodyHtml ?? '');
  if (blocks.length === 0) return base;

  if (!opts.appOrigin) {
    const staticPart = buildInlineWidgetHtml(blocks, opts.flags);
    const trimmed = base.trim();
    return trimmed ? `${trimmed}\n${staticPart}` : staticPart;
  }

  /**
   * Thứ tự process để DOM cuối cùng đúng `block_index` ascending TRONG TỪNG vị trí:
   *   - `end` (append): iterate ascending bi → block sau xếp dưới block trước.
   *   - `after_p_N` (insert sau `</p>`): iterate **descending** bi (cùng N) — mỗi insert chèn giữa `</p>` và phần đã insert trước → desc insert ⇒ asc DOM. Process N lớn trước (giảm shift index).
   *   - `start` (prepend): iterate descending bi — desc prepend ⇒ asc DOM.
   *
   * Iframe markup không chứa `</p>` nên không lệch index `after_p_N` sau insert. Process end → after_p → start.
   */
  const ordered = blocks.slice().sort((a, b) => {
    const ra = positionRank(a.position);
    const rb = positionRank(b.position);
    if (ra !== rb) return rb - ra;
    if (ra === 1) {
      const da = afterIndex(a.position);
      const db = afterIndex(b.position);
      if (da !== db) return db - da;
      return (b.block_index ?? 0) - (a.block_index ?? 0);
    }
    if (ra === 2) return (a.block_index ?? 0) - (b.block_index ?? 0);
    return (b.block_index ?? 0) - (a.block_index ?? 0);
  });

  let result = base.trim();
  ordered.forEach((block) => {
    const iframe = buildIframeEmbedMarkup(
      opts.appOrigin,
      opts.orgId,
      opts.contentType,
      opts.contentId,
      block.block_index,
    );
    if (!iframe) return;
    result = insertAtPosition(result, block.position, iframe);
  });

  return result;
}

/** Chỉ HTML tĩnh (preview / fallback). */
export function mergeBodyHtmlWithWidgetBlocks(
  bodyHtml: string,
  blocks: WidgetBlockRow[],
  flags: WidgetPublicRenderFlags,
): string {
  const base = stripWidgetBlocksSection(bodyHtml ?? '');
  if (blocks.length === 0) return base;
  const injected = buildInlineWidgetHtml(blocks, flags);
  const trimmed = base.trim();
  if (!trimmed) return injected;
  return `${trimmed}\n${injected}`;
}
