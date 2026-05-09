import type { BlockDisplayType, ProductSnapshot } from '../types/widget.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface RenderBlockInput {
  position: string;
  display_type: BlockDisplayType;
  grid_desktop_cols: number;
  grid_mobile_cols: number;
  slider_desktop_count: number;
  slider_mobile_count: number;
  products: ProductSnapshot[];
  enable_add_to_cart: boolean;
  enable_quick_view: boolean;
}

function productCard(p: ProductSnapshot, opts: Pick<RenderBlockInput, 'enable_add_to_cart' | 'enable_quick_view'>): string {
  const img = p.featured_image
    ? `<img class="wg-img" src="${escapeHtml(p.featured_image)}" alt="${escapeHtml(p.title)}" loading="lazy" />`
    : `<div class="wg-img wg-img--placeholder"></div>`;
  const price = p.price ? `<div class="wg-price">${escapeHtml(p.price)}</div>` : '';
  const actions: string[] = [];
  if (opts.enable_add_to_cart) {
    actions.push(`<button type="button" class="wg-btn wg-btn--cart" data-product-id="${escapeHtml(p.id)}">Mua hàng</button>`);
  }
  if (opts.enable_quick_view) {
    actions.push(
      `<button type="button" class="wg-btn wg-btn--qv" data-product-id="${escapeHtml(p.id)}">Xem nhanh</button>`,
    );
  }
  const actionsHtml = actions.length ? `<div class="wg-actions">${actions.join('')}</div>` : '';
  return `<div class="wg-card" data-handle="${escapeHtml(p.handle)}">${img}<div class="wg-body"><div class="wg-title">${escapeHtml(p.title)}</div>${price}${actionsHtml}</div></div>`;
}

export function renderBlockHtml(block: RenderBlockInput): string {
  const cards = block.products.map((p) => productCard(p, block)).join('');
  if (block.display_type === 'slider') {
    const d = block.slider_desktop_count;
    const m = block.slider_mobile_count;
    return `<div class="wg-block wg-block--slider"><div class="swiper wg-slider" data-desktop="${d}" data-mobile="${m}"><div class="swiper-wrapper">${block.products
      .map(
        (p) =>
          `<div class="swiper-slide">${productCard(p, { enable_add_to_cart: block.enable_add_to_cart, enable_quick_view: block.enable_quick_view })}</div>`,
      )
      .join('')}</div></div></div>`;
  }
  const dc = block.grid_desktop_cols;
  const mc = block.grid_mobile_cols;
  return `<div class="wg-block wg-block--grid"><div class="wg-grid wg-cols-${dc} wg-cols-m-${mc}">${cards}</div></div>`;
}
