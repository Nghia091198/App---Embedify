import type { BlockDisplayType, ProductSnapshot } from '../types/widget.js';

/** Escape cho nội dung trong attribute HTML wrap bằng nháy đôi `"..."`. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Escape JSON cho data attribute wrap bằng nháy đơn `'...'`.
 * Giữ nguyên `"` vì JSON cần — chỉ escape `&` và `'`.
 */
function escapeJsonAttr(json: string): string {
  return json.replace(/&/g, '&amp;').replace(/'/g, '&#39;');
}

export interface RenderBlockInput {
  block_title: string | null;
  position: string;
  display_type: BlockDisplayType;
  grid_desktop_cols: number;
  grid_mobile_cols: number;
  /** Khoảng cách giữa các card (px). */
  grid_gap_px: number;
  slider_desktop_count: number;
  slider_mobile_count: number;
  products: ProductSnapshot[];
  enable_add_to_cart: boolean;
  enable_quick_view: boolean;
  show_price: boolean;
  enable_contact: boolean;
  contact_label: string;
  contact_url: string;
  /** Xem `WidgetPublicRenderFlags.product_link_base` */
  product_link_base?: string | null;
}

/**
 * Preview app: `https://{shop_domain}/{link}` — `link` là path từ gốc shop, không có `/` đầu.
 * Trên storefront (không có base): giữ path tương đối hoặc URL tuyệt đối từ API.
 */
function storefrontProductHref(p: ProductSnapshot, productLinkBase: string | null | undefined): string {
  const raw = typeof p.url === 'string' ? p.url.trim() : '';
  const fallbackLink = p.handle ? `products/${p.handle}` : '';
  const baseRaw = productLinkBase?.trim();
  const base = baseRaw ? baseRaw.replace(/\/$/, '') : '';

  if (!base) {
    if (!raw) return fallbackLink ? `/${fallbackLink}` : '#';
    if (/^https?:\/\//i.test(raw)) return raw;
    return raw.startsWith('/') ? raw : `/${raw}`;
  }

  if (/^https?:\/\//i.test(raw)) return raw;
  const link = (raw ? raw.replace(/^\/+/, '') : fallbackLink) || '';
  if (!link) return base;
  return `${base}/${link}`;
}

function productCard(
  p: ProductSnapshot,
  opts: Pick<
    RenderBlockInput,
    | 'enable_add_to_cart'
    | 'enable_quick_view'
    | 'show_price'
    | 'enable_contact'
    | 'contact_label'
    | 'contact_url'
    | 'product_link_base'
  >,
): string {
  const price = p.price ?? 0;
  const compareAt = p.compare_at_price ?? 0;
  const hasSale = compareAt > 0 && compareAt > price;
  const discountPct = hasSale ? Math.round(100 - (price / compareAt) * 100) : 0;
  const badge =
    opts.show_price && hasSale ? `<span class="wg-product-badge">-${discountPct}%</span>` : '';

  const mainImg = p.featured_image
    ? `<img src="${escapeHtml(p.featured_image)}" alt="${escapeHtml(p.title)}" loading="lazy" />`
    : `<svg viewBox="0 0 260 230" xmlns="http://www.w3.org/2000/svg"><rect width="260" height="230" fill="#f0ede8"/><text x="130" y="120" text-anchor="middle" font-size="12" fill="#bbb" font-family="sans-serif">No image</text></svg>`;

  const thumbImages = p.images.slice(0, 4);
  const thumbsHtml =
    thumbImages.length > 0
      ? `<div class="wg-product-thumbs">${thumbImages
          .map(
            (img, i) =>
              `<div class="wg-thumb${i === 0 ? ' active' : ''}" data-src="${escapeHtml(img.src)}" data-idx="${i}"><img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt ?? p.title)}" loading="lazy" /></div>`,
          )
          .join('')}</div>`
      : '';

  const priceHtml = opts.show_price
    ? hasSale
      ? `<div class="wg-product-price-row"><span class="wg-price-sale">${escapeHtml(p.formatted_price ?? '')}</span><span class="wg-price-original">${escapeHtml(p.formatted_compare_at_price ?? '')}</span></div>`
      : `<div class="wg-product-price-row"><span class="wg-price-sale">${escapeHtml(p.formatted_price ?? '')}</span></div>`
    : '';

  /** Wrap data-* JSON bằng nháy đơn → JSON nội bộ giữ nguyên dấu `"`. */
  const variantsJson = escapeJsonAttr(JSON.stringify(p.variants));
  const imagesJson = escapeJsonAttr(JSON.stringify(p.images));
  const optionsJson = escapeJsonAttr(JSON.stringify(p.options));

  const qvSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/></svg>`;

  const qvDataAttrs = `data-product-id="${escapeHtml(p.id)}"
          data-product-title="${escapeHtml(p.title)}"
          data-product-handle="${escapeHtml(p.handle)}"
          data-product-sku="${escapeHtml(p.sku ?? '')}"
          data-product-price="${price}"
          data-product-compare-at-price="${compareAt}"
          data-formatted-price="${escapeHtml(p.formatted_price ?? '')}"
          data-formatted-compare-at-price="${escapeHtml(p.formatted_compare_at_price ?? '')}"
          data-product-featured-image="${escapeHtml(p.featured_image ?? '')}"
          data-product-images='${imagesJson}'
          data-product-variants='${variantsJson}'
          data-product-options='${optionsJson}'
          data-discount-pct="${discountPct}"`;

  const defaultVariant = p.variants.find((v) => v.available) ?? p.variants[0];
  const defaultVariantId = defaultVariant?.id ?? '';

  const cartBtn = opts.enable_add_to_cart
    ? `<button type="button" class="wg-btn-addcart"
          data-variant-id="${escapeHtml(defaultVariantId)}"
          data-product-title="${escapeHtml(p.title)}"
          data-qty="1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          Thêm vào giỏ
        </button>`
    : '';

  const contactUrl = (opts.contact_url ?? '').trim();
  const contactLabel = (opts.contact_label ?? 'Liên hệ').trim() || 'Liên hệ';
  const contactExternal = /^https?:\/\//i.test(contactUrl);
  const contactBtn =
    !opts.enable_add_to_cart && opts.enable_contact && contactUrl
      ? `<a href="${escapeHtml(contactUrl)}" class="wg-btn-contact"${contactExternal ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(contactLabel)}</a>`
      : '';

  const hasCommerceAction = opts.enable_add_to_cart || Boolean(contactBtn);

  const qvBtnBar =
    opts.enable_quick_view && hasCommerceAction
      ? `<button type="button" class="wg-action-view" aria-label="Xem nhanh" ${qvDataAttrs}>${qvSvg}</button>`
      : '';

  const qvOverlayHtml =
    opts.enable_quick_view && !hasCommerceAction
      ? `<div class="wg-product-qv-overlay"><button type="button" class="wg-action-view wg-action-view--overlay" aria-label="Xem nhanh" ${qvDataAttrs}>${qvSvg}</button></div>`
      : '';

  const productHref = escapeHtml(storefrontProductHref(p, opts.product_link_base));
  const imageMainHtml = `<a href="${productHref}" class="wg-product-link" tabindex="-1" aria-label="${escapeHtml(p.title)}"><div class="wg-product-image-wrap">${mainImg}</div></a>`;

  const imageBlock = qvOverlayHtml
    ? `<div class="wg-product-image-outer wg-product-image-outer--qv">${imageMainHtml}${qvOverlayHtml}</div>`
    : imageMainHtml;

  const qtyControl = opts.enable_add_to_cart
    ? `<div class="wg-qty-wrap"><span class="wg-qty-number">1</span><div class="wg-qty-divider"></div><div class="wg-qty-btn-wrap"><button type="button" class="wg-qty-btn wg-qty-plus" aria-label="Tăng">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus" viewBox="0 0 16 16">
  <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4"/>
</svg>
    </button><button type="button" class="wg-qty-btn wg-qty-minus" aria-label="Giảm">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-dash-lg" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M2 8a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11A.5.5 0 0 1 2 8"/>
</svg></button></div></div>`
    : '';

  const actionsHtml =
    qvBtnBar || opts.enable_add_to_cart || contactBtn
      ? `<div class="wg-product-actions">${qvBtnBar}${qtyControl}${cartBtn}${contactBtn}</div>`
      : '';

  return `<div class="wg-product-card" data-product-id="${escapeHtml(p.id)}" data-handle="${escapeHtml(p.handle)}">
    ${badge}
    ${imageBlock}
    ${thumbsHtml}
    <div class="wg-product-info">
      ${p.sku ? `<div class="wg-product-sku" style="display: none;">SKU: ${escapeHtml(p.sku)}</div>` : ''}
      <a href="${productHref}" class="wg-product-name-link"><div class="wg-product-name">${escapeHtml(p.title)}</div></a>
      ${priceHtml}
      ${actionsHtml}
    </div>
  </div>`;
}

const cardOpts = (b: RenderBlockInput) =>
  ({
    enable_add_to_cart: b.enable_add_to_cart,
    enable_quick_view: b.enable_quick_view,
    show_price: b.show_price,
    enable_contact: b.enable_contact,
    contact_label: b.contact_label,
    contact_url: b.contact_url,
    product_link_base: b.product_link_base,
  }) satisfies Pick<
    RenderBlockInput,
    | 'enable_add_to_cart'
    | 'enable_quick_view'
    | 'show_price'
    | 'enable_contact'
    | 'contact_label'
    | 'contact_url'
    | 'product_link_base'
  >;

/** Slider cần prev/next + pagination khi số SP vượt slidesPerView ở desktop hoặc mobile. */
export function sliderNeedsOverflowNav(productCount: number, desktopSlides: number, mobileSlides: number): boolean {
  if (productCount <= 0) return false;
  const d = Number(desktopSlides) || 4;
  const m = Number(mobileSlides) || 1.5;
  return productCount > d || productCount > m;
}

export function renderBlockHtml(block: RenderBlockInput): string {
  const titleTrimmed = (block.block_title ?? '').trim();
  const titleHtml = titleTrimmed
    ? `<div class="wg-block-title">${escapeHtml(titleTrimmed)}</div>`
    : '';

  if (block.products.length === 0) {
    const plusSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`;
    return `<div class="wg-block wg-block--empty">${titleHtml}<div class="wg-block-empty" role="status" aria-label="Chưa có sản phẩm"><span class="wg-block-empty-icon">${plusSvg}</span></div></div>`;
  }

  const co = cardOpts(block);
  const cards = block.products.map((p) => productCard(p, co)).join('');

  const gapPx = Math.min(48, Math.max(8, Math.round(Number(block.grid_gap_px) || 12)));

  if (block.display_type === 'slider') {
    const d = block.slider_desktop_count;
    const m = block.slider_mobile_count;
    const overflow = sliderNeedsOverflowNav(block.products.length, d, m);
    const navHtml = overflow
      ? '<div class="swiper-button-prev" aria-label="Trước"></div><div class="swiper-button-next" aria-label="Sau"></div><div class="swiper-pagination"></div>'
      : '';
    return `<div class="wg-block wg-block--slider">${titleHtml}<div class="swiper wg-slider" data-desktop="${d}" data-mobile="${m}" data-gap="${gapPx}" data-wg-overflow="${overflow ? '1' : '0'}"><div class="swiper-wrapper">${block.products
      .map((p) => `<div class="swiper-slide">${productCard(p, co)}</div>`)
      .join('')}</div>${navHtml}</div></div>`;
  }

  const dc = block.grid_desktop_cols;
  const mc = block.grid_mobile_cols;
  return `<div class="wg-block wg-block--grid">${titleHtml}<div class="wg-grid wg-cols-${dc} wg-cols-m-${mc}" style="gap:${gapPx}px">${cards}</div></div>`;
}
