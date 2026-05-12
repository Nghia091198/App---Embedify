import { renderBlockHtml } from '@/lib/blockRenderer';
import { stripAllHaravanWidgetSections } from '@/lib/mergeBodyForHaravan';
import type { WidgetBlockRow, WidgetPublicRenderFlags } from '@/types/widget';

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

/** Giống storefront: inject từ cuối lên để `after_p_N` không lệch. */
export function sortBlocksForStableInjection(blocks: WidgetBlockRow[]): WidgetBlockRow[] {
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

function injectableParagraphs(container: HTMLElement): Element[] {
  const direct = Array.from(container.querySelectorAll(':scope > p'));
  if (direct.length > 0) return direct;
  return Array.from(container.querySelectorAll('p'));
}

function injectBlockByPosition(container: HTMLElement, el: HTMLElement, position: string): void {
  if (position === 'start') {
    if (container.firstChild) container.insertBefore(el, container.firstChild);
    else container.appendChild(el);
    return;
  }
  if (position === 'end') {
    container.appendChild(el);
    return;
  }
  if (typeof position === 'string' && position.indexOf('after_p_') === 0) {
    const n = parseInt(position.replace('after_p_', ''), 10);
    const paragraphs = injectableParagraphs(container);
    const target = Number.isFinite(n) ? paragraphs[n - 1] : null;
    if (target) target.after(el);
    else container.appendChild(el);
    return;
  }
  container.appendChild(el);
}

export type PreviewStorefrontFlags = WidgetPublicRenderFlags;

/**
 * Preview app: mọi link storefront phải là `https://{shop_domain}/{link}` (link không double-slash).
 * - `/products/...` → `${base}/products/...`
 * - `products/...` (relative theme) → `${base}/products/...`
 */
function rewriteStorefrontLinksForPreview(root: HTMLElement, storefrontBase: string | null | undefined): void {
  const base = storefrontBase?.trim().replace(/\/$/, '');
  if (!base) return;
  root.querySelectorAll('a[href]').forEach((el) => {
    const h = el.getAttribute('href');
    if (h == null) return;
    const t = h.trim();
    if (!t || t.startsWith('#') || /^mailto:/i.test(t) || /^tel:/i.test(t)) return;
    if (/^https?:\/\//i.test(t) || t.startsWith('//')) return;
    if (t.startsWith('/')) {
      el.setAttribute('href', `${base}${t}`);
      return;
    }
    if (/^(products\/|collections\/|pages\/|blogs\/)/i.test(t)) {
      el.setAttribute('href', `${base}/${t}`);
    }
  });
}

export type BuildContentPreviewOptions = {
  activeBlockId?: string | null;
  /** STT hiển thị (1-based) theo thứ tự block trong editor. */
  blockOrdinals?: Record<string, number>;
};

/** Ghép HTML nội dung + block (chỉ browser). */
export function buildContentPreviewHtml(
  bodyHtml: string,
  blocks: WidgetBlockRow[],
  flags: PreviewStorefrontFlags,
  opts?: BuildContentPreviewOptions,
): string {
  if (typeof document === 'undefined') return stripAllHaravanWidgetSections(bodyHtml || '');
  /** Bỏ iframe/script/markers đã push lên Haravan — tránh iframe lồng + block inject trùng trong admin. */
  const baseArticle = stripAllHaravanWidgetSections(bodyHtml ?? '').trim();
  const host = document.createElement('div');
  host.className = 'wg-preview-root text-sm text-slate-800';
  host.innerHTML = baseArticle ? baseArticle : '<p class="text-slate-400">(Trống)</p>';
  rewriteStorefrontLinksForPreview(host, flags.product_link_base);

  if (blocks.length === 0) {
    return host.outerHTML;
  }

  const activeId = opts?.activeBlockId ?? null;
  const ordinals = opts?.blockOrdinals ?? {};
  const sorted = sortBlocksForStableInjection(blocks);
  for (const b of sorted) {
    const html = renderBlockHtml({
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
    });
    const wrapper = document.createElement('div');
    wrapper.className =
      'wg-admin-preview-slot my-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm';
    if (activeId != null && b.id === activeId) {
      wrapper.classList.add('ring-1', 'ring-[#1d9e75]/25');
    }
    wrapper.dataset.wgBlockId = b.id;
    const stt = ordinals[b.id] ?? 1;
    const chrome = document.createElement('div');
    chrome.className =
      'wg-admin-block-chrome flex min-h-9 items-center gap-2 border-b border-slate-100 bg-white px-2 py-1.5';
    const title = document.createElement('span');
    title.className = 'text-sm font-semibold text-slate-800';
    title.textContent = `Block sản phẩm ${stt}`;
    chrome.appendChild(title);
    const body = document.createElement('div');
    body.className = 'wg-admin-preview-slot-body min-h-0 px-2 py-2';
    body.innerHTML = html;
    wrapper.appendChild(chrome);
    wrapper.appendChild(body);
    injectBlockByPosition(host, wrapper, b.position);
  }
  return host.outerHTML;
}

/** Chỉ nội dung bài (strip marker + rewrite link) — dùng phía trên khung preview block. */
export function buildArticleBodyPreviewHtml(bodyHtml: string, flags: PreviewStorefrontFlags): string {
  if (typeof document === 'undefined') return '';
  const baseArticle = stripAllHaravanWidgetSections(bodyHtml ?? '').trim();
  const host = document.createElement('div');
  host.className = 'wg-preview-root text-sm text-slate-800';
  host.innerHTML = baseArticle ? baseArticle : '<p class="text-slate-400">(Trống)</p>';
  rewriteStorefrontLinksForPreview(host, flags.product_link_base);
  return host.outerHTML;
}

/** HTML một block (preview admin — không ghép bài viết). */
export function buildSingleBlockPreviewHtml(
  block: WidgetBlockRow,
  flags: PreviewStorefrontFlags,
): string {
  return renderBlockHtml({
    block_title: block.title,
    position: block.position,
    display_type: block.display_type,
    grid_desktop_cols: block.grid_desktop_cols,
    grid_mobile_cols: block.grid_mobile_cols,
    grid_gap_px: block.grid_gap_px,
    slider_desktop_count: block.slider_desktop_count,
    slider_mobile_count: block.slider_mobile_count,
    products: block.products_cache,
    enable_add_to_cart: flags.enable_add_to_cart,
    enable_quick_view: flags.enable_quick_view,
    show_price: flags.show_price,
    enable_contact: flags.enable_contact,
    contact_label: flags.contact_label,
    contact_url: flags.contact_url,
    product_link_base: flags.product_link_base,
  });
}

/** Preview admin: nội dung bài (đã strip marker) + block đang chọn. */
export function buildArticleWithActiveBlockPreviewHtml(
  bodyHtml: string,
  block: WidgetBlockRow,
  flags: PreviewStorefrontFlags,
): string {
  if (typeof document === 'undefined') return '';
  const baseArticle = stripAllHaravanWidgetSections(bodyHtml ?? '').trim();
  const host = document.createElement('div');
  host.className = 'wg-preview-root text-sm text-slate-800';
  host.innerHTML = baseArticle ? baseArticle : '<p class="text-slate-400">(Trống)</p>';
  rewriteStorefrontLinksForPreview(host, flags.product_link_base);
  const inner = renderBlockHtml({
    block_title: block.title,
    position: block.position,
    display_type: block.display_type,
    grid_desktop_cols: block.grid_desktop_cols,
    grid_mobile_cols: block.grid_mobile_cols,
    grid_gap_px: block.grid_gap_px,
    slider_desktop_count: block.slider_desktop_count,
    slider_mobile_count: block.slider_mobile_count,
    products: block.products_cache,
    enable_add_to_cart: flags.enable_add_to_cart,
    enable_quick_view: flags.enable_quick_view,
    show_price: flags.show_price,
    enable_contact: flags.enable_contact,
    contact_label: flags.contact_label,
    contact_url: flags.contact_url,
    product_link_base: flags.product_link_base,
  });
  const slot = document.createElement('div');
  slot.className = 'wg-admin-preview-slot mt-4 border-t border-slate-200 pt-4';
  slot.innerHTML = inner;
  host.appendChild(slot);
  return host.outerHTML;
}
