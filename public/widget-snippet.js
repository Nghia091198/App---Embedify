/**
 * widget-snippet.js — chạy trên storefront Haravan (qua ScriptTag).
 *
 * Architecture v9:
 *   - iframe (widget-frame.html) hiển thị product cards.
 *   - Cart-add: iframe → postMessage `wg-add-to-cart` → snippet fetch /cart/add.js
 *     với cookie shopper → reply success/error.
 *   - Quickview: iframe → postMessage `wg-open-quickview` → snippet render modal
 *     ngay trong storefront page (position:fixed thật, không phụ thuộc iframe size).
 *   - Resize iframe height: snippet nhận `wg-widget-frame-resize` chỉnh style.height.
 */
(function() {
    'use strict';
    if (window.__wgSnippetBound) return;
    window.__wgSnippetBound = true;

    /** Chuẩn hoá màu chủ đề cho `--wg-color` (snippet trước đây chỉ nhận #rgb/#rrggbb → rơi về #e84040). */
    function wgSanitizeCssColor(raw) {
        var t = String(raw == null ? '' : raw).trim();
        if (!t) return '#e84040';
        if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(t)) return t;
        if (/^[0-9A-Fa-f]{6}$/.test(t)) return '#' + t;
        if (/^[0-9A-Fa-f]{3}$/.test(t)) {
            return '#' + t[0] + t[0] + t[1] + t[1] + t[2] + t[2];
        }
        if (/^rgba?\(/i.test(t) && !/[;{}<]/.test(t)) return t;
        return '#e84040';
    }

    function wgSanitizeFontFamily(raw) {
        return String(raw == null ? '' : raw).replace(/[;}]/g, '').trim();
    }

    /**
     * Đồng bộ theme storefront (QV modal dùng `var(--wg-color)` trên `:root`).
     * Gọi từ `wg-config` và từ `wg-open-quickview` (tránh race: mở QV trước khi iframe kịp post `wg-config`).
     */
    function wgApplyPublicTheme(d) {
        if (!d || typeof d !== 'object') return;
        var st = document.getElementById('wg-qv-config-style');
        if (!st) {
            st = document.createElement('style');
            st.id = 'wg-qv-config-style';
            document.head.appendChild(st);
        }
        var pc = wgSanitizeCssColor(d.primaryColor || d.primary_color);
        var ff = wgSanitizeFontFamily(d.fontFamily || d.font_family);
        var chunk = ':root { --wg-color: ' + pc + ';';
        if (ff) chunk += ' --wg-font: ' + ff + ';';
        chunk += '}';
        var cc = String(d.customCss || d.custom_css || '').trim();
        if (cc) chunk += '\n' + cc;
        st.textContent = chunk;
        var fu = String(d.fontImportUrl || d.font_import_url || '').trim();
        if (fu) {
            var lid = 'wg-qv-font-link';
            var lk = document.getElementById(lid);
            if (!lk) {
                lk = document.createElement('link');
                lk.id = lid;
                lk.rel = 'stylesheet';
                lk.href = fu;
                document.head.appendChild(lk);
            } else if (lk.getAttribute('href') !== fu) {
                lk.setAttribute('href', fu);
            }
        }
    }

    (function wgEnsureRootThemeVars() {
        if (document.getElementById('wg-qv-config-style')) return;
        var st = document.createElement('style');
        st.id = 'wg-qv-config-style';
        st.textContent = ':root { --wg-color: #e84040; }';
        document.head.appendChild(st);
    })();

    var WG_VERSION = 'v13-qv-theme-sync';
    try { console.warn('[wg] snippet loaded', WG_VERSION); } catch (e) {}

    function findSourceIframe(source) {
        var ifs = document.getElementsByTagName('iframe');
        for (var i = 0; i < ifs.length; i++) {
            try { if (ifs[i].contentWindow === source) return ifs[i]; } catch (e) {}
        }
        return null;
    }

    function originFromIframe(fr) {
        var src = fr.getAttribute('src') || '';
        if (!src) return '';
        try { return new URL(src, location.href).origin; } catch (e) { return ''; }
    }

    function updateCartCount() {
        fetch('/cart.js', { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(cart) {
                var n = cart && typeof cart.item_count === 'number' ? cart.item_count : 0;
                var sels = ['.cart-count', '.cart__count', '.cart-link__bubble', '[data-cart-count]', '[data-cart-item-count]', '#CartCount', '.site-header__cart-count'];
                sels.forEach(function(s) {
                    document.querySelectorAll(s).forEach(function(el) {
                        try { el.textContent = String(n); } catch (e) {}
                        try { el.setAttribute('data-cart-count', String(n)); } catch (e) {}
                    });
                });
            })
            .catch(function() {});
    }

    function replyToFrame(source, payload) {
        try { source.postMessage(payload, '*'); } catch (e) {}
    }

    function handleCartAdd(e) {
        var d = e.data;
        var reqId = d.reqId;
        var variantId = d.variantId;
        var quantity = Math.max(1, Number(d.quantity) || 1);
        var title = d.title || '';
        var src = e.source;
        if (!variantId) {
            wgPageToast('Thiếu variant ID', true);
            replyToFrame(src, { type: 'wg-add-to-cart-error', reqId: reqId, message: 'Thiếu variant ID' });
            return;
        }
        wgPageToast('Đang thêm vào giỏ…');
        var body = 'id=' + encodeURIComponent(variantId) + '&quantity=' + encodeURIComponent(quantity);
        fetch('/cart/add.js', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json, text/javascript, */*; q=0.01',
                },
                body: body,
                credentials: 'same-origin',
            })
            .then(function(r) {
                return r.text().then(function(txt) {
                    var json = null;
                    try { json = JSON.parse(txt); } catch (x) {}
                    return { ok: r.ok, status: r.status, json: json, txt: txt };
                });
            })
            .then(function(out) {
                if (!out.ok) {
                    var msg = (out.json && (out.json.description || out.json.message)) || ('Lỗi ' + out.status);
                    wgPageToast(msg, true);
                    replyToFrame(src, { type: 'wg-add-to-cart-error', reqId: reqId, message: msg });
                    return;
                }
                var item = out.json || {};
                /** Toast dùng qty REQUEST (item.quantity là số đã có sẵn trong giỏ — sai ngữ cảnh). */
                wgPageToast('Đã thêm ' + quantity + ' × ' + (item.title || title || 'sản phẩm') + ' vào giỏ');
                replyToFrame(src, {
                    type: 'wg-add-to-cart-success',
                    reqId: reqId,
                    quantity: quantity,
                    title: item.title || title,
                    item: item,
                });
                updateCartCount();
            })
            .catch(function(err) {
                var m = (err && err.message) || 'Lỗi mạng';
                wgPageToast(m, true);
                replyToFrame(src, { type: 'wg-add-to-cart-error', reqId: reqId, message: m });
            });
    }

    // ============================================================
    // QUICKVIEW — render modal trong storefront page (không phụ thuộc iframe)
    // ============================================================
    var WG_QV = {
        state: null,
        selected: {},
        variant: null,
        mainSwiper: null,
        thumbsSwiper: null,
        sourceFrame: null,
    };

    /** Swiper scoped — KHÔNG dùng window.Swiper của theme (có thể v5/v6 khác API). */
    var WG_SWIPER = null;

    var WG_QV_STYLE_ID = 'wg-qv-page-style';
    var WG_QV_OVERLAY_ID = 'wg-qv-page-overlay';

    function wgQvInjectStyle() {
        if (document.getElementById(WG_QV_STYLE_ID)) return;
        var s = document.createElement('style');
        s.id = WG_QV_STYLE_ID;
        s.textContent = [
            'button:focus,button:focus-visible{border:none;outline:none;}',
            '#wg-qv-page-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;align-items:center;justify-content:center;padding:16px;font-family:var(--wg-font,system-ui,sans-serif);}',
            '#wg-qv-page-overlay.wg-open{display:flex;}',
            '.wg-pqv-modal{background:#fff;border-radius:16px;border:1px solid color-mix(in srgb,var(--wg-color,#e84040) 26%,#e5e5e5);width:100%;max-width:900px;max-height:90vh;overflow:hidden;display:grid;grid-template-columns:1fr 1fr;position:relative;box-shadow:0 24px 60px rgba(0,0,0,.25);}',
            '@media(max-width:640px){.wg-pqv-modal{grid-template-columns:1fr;max-height:92vh;overflow-y:auto;}}',
            '.wg-pqv-close{position:absolute;top:10px;right:10px;width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,255,255,.92);cursor:pointer;z-index:5;font-size:22px;color:#333;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.12);line-height:1;}',
            '.wg-pqv-close:hover{background:#fff;}',
            '.wg-pqv-gallery{padding:20px;display:flex;flex-direction:column;min-height:320px;min-width:0;}',
            '.wg-pqv-main-swiper{width:100%;flex:1;min-height:320px;min-width:0;border-radius:8px;overflow:hidden;}',
            '.wg-pqv-main-swiper .swiper-slide{display:flex;align-items:center;justify-content:center;height:360px;}',
            '.wg-pqv-main-swiper img{width:100%;height:100%;object-fit:contain;}',
            '.wg-pqv-main-swiper .swiper-button-prev,.wg-pqv-main-swiper .swiper-button-next{display:none!important;}',
            '.wg-pqv-thumbs-wrap{position:relative;margin-top:5px;padding:0 36px;}',
            '.wg-pqv-thumbs-swiper{min-width:0;}',
            '.wg-pqv-thumbs-swiper .swiper-slide{width:64px!important;height:64px;border-radius:8px;overflow:hidden;cursor:pointer;border:1px solid transparent;box-sizing:border-box;opacity:.65;transition:opacity .15s,border-color .15s;}',
            '.wg-pqv-thumbs-swiper .swiper-slide:hover{opacity:1;}',
            '.wg-pqv-thumbs-swiper .swiper-slide-thumb-active{border-color:var(--wg-color,#e84040);opacity:1;}',
            '.wg-pqv-thumbs-swiper img{width:100%;height:100%;object-fit:cover;}',
            '.wg-pqv-thumbs-nav{position:absolute;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;border:none;background:#eee;color:#333;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;transition:background .15s;}',
            '.wg-pqv-thumbs-nav:hover{background:#ddd;}',
            '.wg-pqv-thumbs-nav.swiper-button-disabled{opacity:.35;cursor:not-allowed;}',
            '.wg-pqv-thumbs-nav.wg-prev{left:0;}',
            '.wg-pqv-thumbs-nav.wg-next{right:0;}',
            '.wg-pqv-thumbs-nav svg{width:14px;height:14px;}',
            '.wg-pqv-info{padding:24px 22px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;}@media(min-width:641px){.wg-pqv-modal>.wg-pqv-info{border-left:1px solid color-mix(in srgb,var(--wg-color,#e84040) 22%,#ececec);}}',
            '.wg-pqv-title{font-size:20px;font-weight:700;color:#1a1a1a;line-height:1.35;margin:0;padding-right:30px;}',
            '.wg-pqv-meta{display:flex;gap:8px;font-size:12px;color:#666;line-height:1.5;}',
            '.wg-pqv-meta .wg-pqv-meta-label{color:#999;font-weight:500;}',
            '.wg-pqv-meta .wg-pqv-meta-val{color:#333;font-weight:600;}',
            '.wg-pqv-meta .wg-pqv-stock-in{color:#1d9e75;}',
            '.wg-pqv-meta .wg-pqv-stock-out{color:var(--wg-color,#e84040);}',
            '.wg-pqv-price-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:2px;}',
            '.wg-pqv-sale{font-size:24px;font-weight:800;color:var(--wg-color,#e84040);}',
            '.wg-pqv-orig{font-size:14px;color:#bbb;text-decoration:line-through;}',
            '#wg-pqv-options{display:flex;flex-direction:column;gap:15px;}',
            '.wg-pqv-disc{font-size:11px;font-weight:700;color:#fff;background:var(--wg-color,#e84040);padding:3px 6px;border-radius:4px;}',
            '.wg-pqv-opt{display:flex;flex-direction:column;gap:6px;}',
            '.wg-pqv-opt-label{font-size:12px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.3px;}',
            '.wg-pqv-opt-label .wg-pqv-opt-label-text{font-weight:700;color:var(--wg-color,#e84040);text-transform:none;letter-spacing:0;}',
            '.wg-pqv-opt-values{display:flex;flex-wrap:wrap;gap:8px;}',
            '.wg-pqv-swatch{min-width:45px;padding:7px 14px;border:1.5px solid color-mix(in srgb,var(--wg-color,#e84040) 24%,#ddd);border-radius:8px;background:#fff;font-size:13px;font-weight:500;cursor:pointer;transition:border-color .15s,background .15s,color .15s,opacity .15s;color:#333;font-family:inherit;}',
            '.wg-pqv-swatch:hover{border-color:var(--wg-color,#e84040);}',
            '.wg-pqv-swatch.wg-active{border-color:var(--wg-color,#e84040);background:color-mix(in srgb,var(--wg-color,#e84040) 12%,#fff);color:var(--wg-color,#e84040);font-weight:700;}',
            '.wg-pqv-swatch.wg-soldout{opacity:.35;cursor:not-allowed;text-decoration:line-through;}',
            '.wg-pqv-bottom{margin-top:6px;display:flex;flex-direction:column;gap:8px;}',
            '.wg-pqv-row{display:flex;gap:10px;align-items:stretch;}',
            '.wg-pqv-qty{display:flex;align-items:center;border:1.5px solid color-mix(in srgb,var(--wg-color,#e84040) 30%,#e0ddd8);border-radius:10px;overflow:hidden;flex-shrink:0;height:38px;}',
            '.wg-pqv-qty-btn{width:36px;height:38px;background:#fff;border:none;cursor:pointer;font-size:18px;color:#555;font-weight:600;}',
            '.wg-pqv-qty-btn:hover{background:#f5f3ef;}',
            '.wg-pqv-qty-num{width:38px;height:38px;line-height:38px;text-align:center;font-size:14px;font-weight:400;color:#222;border-left:1px solid color-mix(in srgb,var(--wg-color,#e84040) 28%,#e0ddd8);border-right:1px solid color-mix(in srgb,var(--wg-color,#e84040) 28%,#e0ddd8);}',
            '.wg-pqv-btn{flex:1;border:none;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;height:44px;transition:background .15s,opacity .15s;font-family:inherit;color:#fff;}',
            '.wg-pqv-add{background:var(--wg-color,#e84040);}',
            '.wg-pqv-add:hover{background:color-mix(in srgb,var(--wg-color,#e84040) 85%,black);}',
            '.wg-pqv-buy{border:1px solid var(--wg-color,#e84040);min-height:44px;background:transparent;color:var(--wg-color,#e84040);}',
            '.wg-pqv-buy:hover{background:var(--wg-color,#e84040);color:#fff;}',
            '.wg-pqv-btn:disabled{background:#aaa;cursor:not-allowed;}',
            '.wg-pqv-btn.wg-loading{background:#888;cursor:not-allowed;}',
            '.wg-pqv-btn.wg-success{background:#27ae60;}',
            '.wg-pqv-detail{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#888;text-decoration:none;margin-top:4px;}',
            '.wg-pqv-detail:hover{color:var(--wg-color,#e84040);}',
            '#wg-page-toast{position:fixed;top:10vh;right:24px;transform:translateX(20px);background:#1d9e75;color:#fff;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:600;z-index:2147483647;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;max-width:min(360px,90vw);box-shadow:0 8px 24px rgba(0,0,0,.18);font-family:system-ui,sans-serif;line-height:1.4;}',
            '#wg-page-toast.wg-show{opacity:1;transform:translateX(0);}',
            '#wg-page-toast.wg-error{background:var(--wg-color,#e84040);}',
            '@media(max-width:640px){#wg-page-toast{right:12px;left:12px;max-width:none;top:8vh;}}',
        ].join('');
        document.head.appendChild(s);
    }

    function wgQvInjectHtml() {
        /** Rebuild DOM mỗi lần open — Swiper destroy+reinit cùng container hay đo width=0. */
        var existing = document.getElementById(WG_QV_OVERLAY_ID);
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        var el = document.createElement('div');
        el.id = WG_QV_OVERLAY_ID;
        el.innerHTML = [
            '<div class="wg-pqv-modal">',
            '<button class="wg-pqv-close" id="wg-pqv-close" aria-label="Đóng">&times;</button>',
            '<div class="wg-pqv-gallery">',
            '<div class="swiper wg-pqv-main-swiper" id="wg-pqv-main">',
            '<div class="swiper-wrapper" id="wg-pqv-main-wrap"></div>',
            '<div class="swiper-button-prev"></div>',
            '<div class="swiper-button-next"></div>',
            '</div>',
            '<div class="wg-pqv-thumbs-wrap">',
            '<button class="wg-pqv-thumbs-nav wg-prev" id="wg-pqv-thumb-prev" aria-label="Trước">',
            '<svg viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
            '</button>',
            '<div class="swiper wg-pqv-thumbs-swiper" id="wg-pqv-thumbs">',
            '<div class="swiper-wrapper" id="wg-pqv-thumbs-wrap"></div>',
            '</div>',
            '<button class="wg-pqv-thumbs-nav wg-next" id="wg-pqv-thumb-next" aria-label="Sau">',
            '<svg viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
            '</button>',
            '</div>',
            '</div>',
            '<div class="wg-pqv-info">',
            '<h2 class="wg-pqv-title" id="wg-pqv-title"></h2>',
            '<div class="wg-pqv-meta" id="wg-pqv-meta">',
            '<div><span class="wg-pqv-meta-label">SKU: </span><span class="wg-pqv-meta-val" id="wg-pqv-sku">—</span></div>',
            '<div><span class="wg-pqv-meta-label">Tình trạng: </span><span class="wg-pqv-meta-val" id="wg-pqv-stock">—</span></div>',
            '</div>',
            '<div class="wg-pqv-price-row">',
            '<span class="wg-pqv-sale" id="wg-pqv-sale"></span>',
            '<span class="wg-pqv-orig" id="wg-pqv-orig"></span>',
            '<span class="wg-pqv-disc" id="wg-pqv-disc" style="display:none"></span>',
            '</div>',
            '<div id="wg-pqv-options"></div>',
            '<div class="wg-pqv-bottom">',
            '<div class="wg-pqv-row" id="wg-pqv-purchase-row">',
            '<div class="wg-pqv-qty">',
            '<button class="wg-pqv-qty-btn" id="wg-pqv-minus">−</button>',
            '<div class="wg-pqv-qty-num" id="wg-pqv-qty">1</div>',
            '<button class="wg-pqv-qty-btn" id="wg-pqv-plus">+</button>',
            '</div>',
            '<button class="wg-pqv-btn wg-pqv-add" id="wg-pqv-add">',
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
            '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>',
            '<path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
            '</svg>',
            '<span id="wg-pqv-add-label">Thêm vào giỏ</span>',
            '</button>',
            '</div>',
            '<a class="wg-pqv-btn wg-pqv-add" id="wg-pqv-contact" href="#" style="display:none;text-decoration:none;"></a>',
            '<button class="wg-pqv-btn wg-pqv-buy" id="wg-pqv-buy">',
            '<span id="wg-pqv-buy-label">Mua ngay</span>',
            '</button>',
            '</div>',
            '<a class="wg-pqv-detail" id="wg-pqv-detail" href="#">Xem chi tiết sản phẩm →</a>',
            '</div>',
            '</div>',
        ].join('');
        document.body.appendChild(el);

        document.getElementById('wg-pqv-close').onclick = wgCloseQuickviewInPage;
        el.addEventListener('click', function(ev) { if (ev.target === el) wgCloseQuickviewInPage(); });
        document.getElementById('wg-pqv-minus').onclick = function() {
            var n = parseInt(document.getElementById('wg-pqv-qty').textContent, 10) || 1;
            document.getElementById('wg-pqv-qty').textContent = String(Math.max(1, n - 1));
        };
        document.getElementById('wg-pqv-plus').onclick = function() {
            var n = parseInt(document.getElementById('wg-pqv-qty').textContent, 10) || 1;
            document.getElementById('wg-pqv-qty').textContent = String(n + 1);
        };
        document.getElementById('wg-pqv-add').onclick = function() {
            var btn = this;
            if (btn.disabled || btn.classList.contains('wg-loading')) return;
            var v = WG_QV.variant;
            if (!v || !v.id) { wgPageToast('Vui lòng chọn phân loại', true); return; }
            var qty = parseInt(document.getElementById('wg-pqv-qty').textContent, 10) || 1;
            var title = WG_QV.state ? WG_QV.state.title : '';
            wgQvAddToCart(String(v.id), qty, title, btn, /* redirect */ false);
        };
        document.getElementById('wg-pqv-buy').onclick = function() {
            var btn = this;
            if (btn.disabled || btn.classList.contains('wg-loading')) return;
            var v = WG_QV.variant;
            if (!v || !v.id) { wgPageToast('Vui lòng chọn phân loại', true); return; }
            var qty = parseInt(document.getElementById('wg-pqv-qty').textContent, 10) || 1;
            var title = WG_QV.state ? WG_QV.state.title : '';
            wgQvAddToCart(String(v.id), qty, title, btn, /* redirect */ true);
        };
        /** Nav prev/next: Swiper config `navigation` đã bind sẵn (xem wgQvInitSwipers). */
        document.addEventListener('keydown', function(ev) {
            if (ev.key === 'Escape' && document.getElementById(WG_QV_OVERLAY_ID).classList.contains('wg-open')) {
                wgCloseQuickviewInPage();
            }
        });
    }

    var wgPageToastTimer = null;

    function wgEnsureToastEl() {
        var el = document.getElementById('wg-page-toast');
        if (el && el.parentNode === document.body) return el;
        if (el && el.parentNode) el.parentNode.removeChild(el);
        wgQvInjectStyle();
        el = document.createElement('div');
        el.id = 'wg-page-toast';
        document.body.appendChild(el);
        return el;
    }

    function wgPageToast(msg, isError) {
        var el = wgEnsureToastEl();
        el.textContent = msg;
        el.classList.toggle('wg-error', !!isError);
        el.classList.add('wg-show');
        if (wgPageToastTimer) clearTimeout(wgPageToastTimer);
        wgPageToastTimer = setTimeout(function() { el.classList.remove('wg-show'); }, 3200);
    }

    function wgFmtMoney(n) {
        n = Number(n);
        if (!isFinite(n)) return '';
        return n.toLocaleString('vi-VN') + ' ₫';
    }

    function wgQvFindVariant() {
        var p = WG_QV.state;
        if (!p || !p.variants) return null;
        var sel = WG_QV.selected;
        for (var i = 0; i < p.variants.length; i++) {
            var v = p.variants[i];
            var ok = true;
            (p.options || []).forEach(function(opt, idx) {
                var name = opt.name || opt;
                var picked = sel[name];
                if (picked && [v.option1, v.option2, v.option3][idx] !== picked) ok = false;
            });
            if (ok) return v;
        }
        return p.variants[0] || null;
    }

    function wgQvUpdatePrice() {
        var v = WG_QV.variant;
        var saleEl = document.getElementById('wg-pqv-sale');
        var origEl = document.getElementById('wg-pqv-orig');
        var discEl = document.getElementById('wg-pqv-disc');
        var addBtn = document.getElementById('wg-pqv-add');
        var addLbl = document.getElementById('wg-pqv-add-label');
        var buyBtn = document.getElementById('wg-pqv-buy');
        var buyLbl = document.getElementById('wg-pqv-buy-label');
        var skuEl = document.getElementById('wg-pqv-sku');
        var stockEl = document.getElementById('wg-pqv-stock');
        if (!saleEl) return;
        var price = v ? v.price : 0;
        var compare = v ? v.compare_at_price : 0;
        saleEl.textContent = wgFmtMoney(price);
        if (origEl) {
            origEl.textContent = (compare && compare > price) ? wgFmtMoney(compare) : '';
            origEl.style.display = (compare && compare > price) ? '' : 'none';
        }
        if (discEl) {
            if (compare && compare > price) {
                discEl.textContent = '-' + Math.round(((compare - price) / compare) * 100) + '%';
                discEl.style.display = '';
            } else {
                discEl.style.display = 'none';
            }
        }
        var soldout = v && v.available === false;
        /** SKU lấy theo variant trước, fallback product.sku. */
        if (skuEl) {
            var sku = (v && v.sku) || (WG_QV.state && WG_QV.state.sku) || '';
            skuEl.textContent = sku || '—';
        }
        if (stockEl) {
            stockEl.textContent = soldout ? 'Hết hàng' : 'Còn hàng';
            stockEl.classList.toggle('wg-pqv-stock-in', !soldout);
            stockEl.classList.toggle('wg-pqv-stock-out', !!soldout);
        }
        if (addBtn && addLbl) {
            addBtn.disabled = soldout;
            addLbl.textContent = soldout ? 'Hết hàng' : 'Thêm vào giỏ';
            addBtn.dataset.variantId = v && v.id != null ? String(v.id) : '';
        }
        if (buyBtn && buyLbl) {
            buyBtn.disabled = soldout;
            buyLbl.textContent = soldout ? 'Hết hàng' : 'Mua ngay';
            buyBtn.dataset.variantId = v && v.id != null ? String(v.id) : '';
        }
    }

    function wgQvRenderOptions() {
        var box = document.getElementById('wg-pqv-options');
        if (!box) return;
        box.innerHTML = '';
        var p = WG_QV.state;
        if (!p || !p.options || !p.options.length) return;
        if (p.options.length === 1) {
            var n = p.options[0].name || p.options[0];
            if (n && n.toLowerCase() === 'title') return;
        }
        p.options.forEach(function(opt, idx) {
            var name = opt.name || opt;
            var values = opt.values || [];
            if (!values.length) {
                var seen = {};
                (p.variants || []).forEach(function(v) {
                    var val = [v.option1, v.option2, v.option3][idx];
                    if (val != null && !seen[val]) {
                        seen[val] = true;
                        values.push(val);
                    }
                });
            }
            var row = document.createElement('div');
            row.className = 'wg-pqv-opt';
            var lbl = document.createElement('div');
            lbl.className = 'wg-pqv-opt-label';
            lbl.appendChild(document.createTextNode(name + ': '));
            var lblVal = document.createElement('span');
            lblVal.className = 'wg-pqv-opt-label-text';
            lblVal.textContent = WG_QV.selected[name] || '';
            lbl.appendChild(lblVal);
            row.appendChild(lbl);
            var vals = document.createElement('div');
            vals.className = 'wg-pqv-opt-values';
            values.forEach(function(val) {
                var temp = Object.assign({}, WG_QV.selected);
                temp[name] = val;
                var matched = (p.variants || []).find(function(v) {
                    return (p.options || []).every(function(o, i) {
                        var n2 = o.name || o;
                        return !temp[n2] || [v.option1, v.option2, v.option3][i] === temp[n2];
                    });
                });
                var soldout = !matched || matched.available === false;
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'wg-pqv-swatch' +
                    (WG_QV.selected[name] === val ? ' wg-active' : '') +
                    (soldout ? ' wg-soldout' : '');
                btn.disabled = soldout;
                btn.textContent = val;
                btn.dataset.optName = name;
                btn.dataset.optVal = val;
                vals.appendChild(btn);
            });
            row.appendChild(vals);
            box.appendChild(row);
        });
    }

    function wgQvSlideToVariant() {
        var v = WG_QV.variant;
        if (!v || !WG_QV.mainSwiper) return;
        var imgUrl = v.featured_image && (v.featured_image.src || v.featured_image);
        if (!imgUrl) return;
        var images = (WG_QV.state && WG_QV.state.images) || [];

        function strip(s) { return String(s || '').replace(/^https?:/, '').replace(/^\/\//, '').split('?')[0]; }
        var target = strip(imgUrl);
        for (var i = 0; i < images.length; i++) {
            if (strip(images[i].src || images[i]) === target) {
                try { WG_QV.mainSwiper.slideTo(i, 200); } catch (e) {}
                return;
            }
        }
    }

    function wgQvInitSwipers(retryCount) {
        retryCount = retryCount || 0;
        if (WG_QV.thumbsSwiper) { try { WG_QV.thumbsSwiper.destroy(true, true); } catch (e) {} }
        if (WG_QV.mainSwiper) { try { WG_QV.mainSwiper.destroy(true, true); } catch (e) {} }
        WG_QV.mainSwiper = null;
        WG_QV.thumbsSwiper = null;
        var Swiper = WG_SWIPER || window.Swiper;
        if (!Swiper) { try { console.warn('[wg-qv] no Swiper available'); } catch (e) {} return; }
        var thumbEl = document.getElementById('wg-pqv-thumbs');
        var mainEl = document.getElementById('wg-pqv-main');
        if (!thumbEl || !mainEl) return;

        /** Container width=0 (modal đang transition / theme đè display:none) → defer + retry. */
        var w = mainEl.getBoundingClientRect().width;
        if (w < 10 && retryCount < 8) {
            setTimeout(function() { wgQvInitSwipers(retryCount + 1); }, 60);
            return;
        }
        if (w < 10) { try { console.warn('[wg-qv] width still 0 after retries — abort Swiper init'); } catch (e) {} return; }

        try {
            WG_QV.thumbsSwiper = new Swiper(thumbEl, {
                slidesPerView: 'auto',
                spaceBetween: 8,
                watchSlidesProgress: true,
                freeMode: true,
            });
            WG_QV.mainSwiper = new Swiper(mainEl, {
                slidesPerView: 1,
                spaceBetween: 0,
                observer: true,
                observeParents: true,
                /** Bind nav vào nút thumb-prev/next để Swiper auto thêm class `swiper-button-disabled`. */
                navigation: {
                    nextEl: '#wg-pqv-thumb-next',
                    prevEl: '#wg-pqv-thumb-prev',
                },
                thumbs: { swiper: WG_QV.thumbsSwiper },
            });
            try {
                WG_QV.mainSwiper.update();
                WG_QV.thumbsSwiper.update();
            } catch (e) {}
        } catch (e) {
            try { console.warn('[wg-qv] Swiper init failed', e); } catch (er) {}
        }
    }

    /**
     * Load Swiper@11 vào scope WG_SWIPER. Rule:
     *   1. Nếu site đã có `window.Swiper` (theme dùng) → tái sử dụng, KHÔNG load thêm để tránh
     *      double-version. Chấp nhận rủi ro API khác (v5/v6) — đa số rule cơ bản (slidesPerView,
     *      thumbs, navigation) vẫn tương thích từ v5+.
     *   2. Nếu chưa có → load v11 từ CDN, capture vào `WG_SWIPER`, restore `window.Swiper` cũ.
     */
    function wgLoadSwiperThenInit(cb) {
        if (WG_SWIPER) { setTimeout(cb, 0); return; }
        if (window.Swiper) {
            WG_SWIPER = window.Swiper;
            try { console.warn('[wg-qv] reuse existing window.Swiper'); } catch (e) {}
            setTimeout(cb, 0);
            return;
        }
        if (!document.getElementById('wg-pqv-swiper-css')) {
            var css = document.createElement('link');
            css.id = 'wg-pqv-swiper-css';
            css.rel = 'stylesheet';
            css.href = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css';
            document.head.appendChild(css);
        }

        function onReady() {
            WG_SWIPER = window.Swiper || WG_SWIPER;
            setTimeout(cb, 0);
        }
        var existing = document.getElementById('wg-pqv-swiper-js');
        if (existing) {
            if (window.Swiper) { onReady(); return; }
            existing.addEventListener('load', onReady, { once: true });
            return;
        }
        var prevSwiper = window.Swiper;
        var js = document.createElement('script');
        js.id = 'wg-pqv-swiper-js';
        js.src = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';
        js.onload = function() {
            WG_SWIPER = window.Swiper;
            /** Khôi phục Swiper của theme (nếu có) để không phá script khác. */
            if (prevSwiper) {
                try { window.Swiper = prevSwiper; } catch (e) {}
            }
            setTimeout(cb, 0);
        };
        document.head.appendChild(js);
    }

    function wgOpenQuickviewInPage(product, sourceFrame, ui) {
        if (!product) return;
        ui = ui || {};
        wgQvInjectStyle();
        wgQvInjectHtml();

        WG_QV.state = product;
        WG_QV.sourceFrame = sourceFrame || null;
        WG_QV.selected = {};

        var firstAvail = (product.variants || []).find(function(v) { return v.available !== false; });
        var def = firstAvail || (product.variants || [])[0];
        if (def) {
            (product.options || []).forEach(function(opt, idx) {
                var name = opt.name || opt;
                WG_QV.selected[name] = [def.option1, def.option2, def.option3][idx];
            });
        }
        WG_QV.variant = def || null;

        var titleEl = document.getElementById('wg-pqv-title');
        if (titleEl) titleEl.textContent = product.title || '';
        var detailEl = document.getElementById('wg-pqv-detail');
        if (detailEl) detailEl.href = '/products/' + (product.handle || '');
        var qtyEl = document.getElementById('wg-pqv-qty');
        if (qtyEl) qtyEl.textContent = '1';

        wgQvRenderOptions();
        wgQvUpdatePrice();

        var showPrice = ui.showPrice !== false;
        var enableCart = ui.enableAddToCart !== false;
        var enableContact = !!ui.enableContact;
        var contactUrl = String(ui.contactUrl || '').trim();
        var contactLabel = String(ui.contactLabel || 'Liên hệ').trim() || 'Liên hệ';
        var priceRow = document.querySelector('.wg-pqv-price-row');
        if (priceRow) priceRow.style.display = showPrice ? '' : 'none';
        var purchaseRow = document.getElementById('wg-pqv-purchase-row');
        var buyBtn = document.getElementById('wg-pqv-buy');
        var contactEl = document.getElementById('wg-pqv-contact');
        if (!enableCart && enableContact && contactUrl) {
            if (purchaseRow) purchaseRow.style.display = 'none';
            if (buyBtn) buyBtn.style.display = 'none';
            if (contactEl) {
                contactEl.style.display = 'flex';
                contactEl.setAttribute('href', contactUrl);
                contactEl.textContent = contactLabel;
                if (/^https?:\/\//i.test(contactUrl)) {
                    contactEl.setAttribute('target', '_blank');
                    contactEl.setAttribute('rel', 'noopener noreferrer');
                } else {
                    contactEl.removeAttribute('target');
                    contactEl.removeAttribute('rel');
                }
            }
        } else if (!enableCart) {
            if (purchaseRow) purchaseRow.style.display = 'none';
            if (buyBtn) buyBtn.style.display = 'none';
            if (contactEl) contactEl.style.display = 'none';
        } else {
            if (purchaseRow) purchaseRow.style.display = '';
            if (buyBtn) buyBtn.style.display = '';
            if (contactEl) contactEl.style.display = 'none';
        }

        var mainWrap = document.getElementById('wg-pqv-main-wrap');
        var thumbWrap = document.getElementById('wg-pqv-thumbs-wrap');
        if (mainWrap) mainWrap.innerHTML = '';
        if (thumbWrap) thumbWrap.innerHTML = '';
        var imgs = product.images && product.images.length ? product.images :
            (product.featured_image ? [{ src: product.featured_image }] : []);
        imgs.forEach(function(img) {
            var src = img.src || img;
            if (mainWrap) {
                var ms = document.createElement('div');
                ms.className = 'swiper-slide';
                ms.innerHTML = '<img src="' + src + '" alt="" loading="lazy" />';
                mainWrap.appendChild(ms);
            }
            if (thumbWrap) {
                var ts = document.createElement('div');
                ts.className = 'swiper-slide';
                ts.innerHTML = '<img src="' + src + '" alt="" loading="lazy" />';
                thumbWrap.appendChild(ts);
            }
        });

        var overlay = document.getElementById(WG_QV_OVERLAY_ID);
        if (overlay) overlay.classList.add('wg-open');
        document.body.style.overflow = 'hidden';

        wgLoadSwiperThenInit(function() {
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    wgQvInitSwipers();
                    wgQvSlideToVariant();
                });
            });
        });
    }

    function wgCloseQuickviewInPage() {
        if (WG_QV.thumbsSwiper) { try { WG_QV.thumbsSwiper.destroy(true, true); } catch (e) {} }
        if (WG_QV.mainSwiper) { try { WG_QV.mainSwiper.destroy(true, true); } catch (e) {} }
        WG_QV.mainSwiper = null;
        WG_QV.thumbsSwiper = null;
        WG_QV.state = null;
        WG_QV.variant = null;
        WG_QV.sourceFrame = null;
        document.body.style.overflow = '';
        /** Remove DOM thay vì hide — open lần sau rebuild lại Swiper trên container mới. */
        var overlay = document.getElementById(WG_QV_OVERLAY_ID);
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    /** Swatch click trong modal — đặt trên document để bind 1 lần, valid sau khi html injected. */
    document.addEventListener('click', function(e) {
        var sw = e.target.closest && e.target.closest('.wg-pqv-swatch');
        if (!sw || sw.disabled) return;
        if (!WG_QV.state) return;
        var name = sw.dataset.optName;
        var val = sw.dataset.optVal;
        if (!name) return;
        WG_QV.selected[name] = val;
        WG_QV.variant = wgQvFindVariant();
        wgQvRenderOptions();
        wgQvUpdatePrice();
        wgQvSlideToVariant();
        if (WG_QV.mainSwiper) { try { WG_QV.mainSwiper.update(); } catch (er) {} }
        if (WG_QV.thumbsSwiper) { try { WG_QV.thumbsSwiper.update(); } catch (er) {} }
    });

    /**
     * Add-to-cart trong QV. `redirect=true` → success thì chuyển `/checkout` (nút Mua ngay).
     */
    function wgQvAddToCart(variantId, qty, title, btn, redirect) {
        if (!variantId) { wgPageToast('Vui lòng chọn phân loại', true); return; }
        if (btn) {
            btn.classList.add('wg-loading');
            btn.disabled = true;
        }
        wgPageToast(redirect ? 'Đang chuyển sang thanh toán…' : 'Đang thêm vào giỏ…');
        var body = 'id=' + encodeURIComponent(variantId) + '&quantity=' + encodeURIComponent(qty);
        fetch('/cart/add.js', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    Accept: 'application/json, text/javascript, */*; q=0.01',
                },
                body: body,
                credentials: 'same-origin',
            })
            .then(function(r) {
                return r.text().then(function(txt) {
                    var j = null;
                    try { j = JSON.parse(txt); } catch (x) {}
                    return { ok: r.ok, j: j, status: r.status };
                });
            })
            .then(function(out) {
                if (btn) {
                    btn.classList.remove('wg-loading');
                    btn.disabled = false;
                }
                if (!out.ok) {
                    var msg = (out.j && (out.j.description || out.j.message)) || ('Lỗi ' + out.status);
                    wgPageToast(msg, true);
                    return;
                }
                var item = out.j || {};
                if (redirect) {
                    /** Mua ngay: thêm xong → chuyển trực tiếp /checkout, không cần toast/animate. */
                    window.location.href = '/checkout';
                    return;
                }
                wgPageToast('Đã thêm ' + qty + ' × ' + (item.title || title) + ' vào giỏ');
                if (btn) {
                    btn.classList.add('wg-success');
                    var lbl = btn.querySelector('span');
                    var origLbl = lbl ? lbl.textContent : '';
                    if (lbl) lbl.textContent = 'Đã thêm!';
                    setTimeout(function() {
                        btn.classList.remove('wg-success');
                        if (lbl) lbl.textContent = origLbl;
                    }, 2200);
                }
                updateCartCount();
            })
            .catch(function(err) {
                if (btn) {
                    btn.classList.remove('wg-loading');
                    btn.disabled = false;
                }
                wgPageToast((err && err.message) || 'Lỗi mạng', true);
            });
    }

    // ============================================================
    // MESSAGE LISTENER
    // ============================================================
    window.addEventListener('message', function(e) {
        var d = e.data;
        if (!d || typeof d !== 'object') return;

        if (d.type === 'wg-config') {
            wgApplyPublicTheme(d);
            return;
        }

        /* ---------- Cart-add: fetch /cart/add.js với cookie shopper ---------- */
        if (d.type === 'wg-add-to-cart') {
            handleCartAdd(e);
            return;
        }

        /* ---------- Quickview: render modal trong storefront page ---------- */
        if (d.type === 'wg-open-quickview') {
            wgApplyPublicTheme(d);
            wgOpenQuickviewInPage(d.product, e.source, {
                showPrice: d.showPrice !== false,
                enableAddToCart: d.enableAddToCart !== false,
                enableContact: !!d.enableContact,
                contactLabel: d.contactLabel || 'Liên hệ',
                contactUrl: d.contactUrl || '',
            });
            return;
        }
        if (d.type === 'wg-close-quickview') {
            wgCloseQuickviewInPage();
            return;
        }

        /* ---------- Cart updated: refresh count ---------- */
        if (d.type === 'wg-cart-updated') {
            updateCartCount();
            return;
        }

        /* ---------- Resize iframe height ---------- */
        if (d.type !== 'wg-widget-frame-resize' && d.type !== 'wg-resize') return;
        if (typeof d.height !== 'number') return;
        var h = Math.max(80, d.height | 0);
        var fr3 = findSourceIframe(e.source);
        if (!fr3) return;
        var origin = originFromIframe(fr3);
        if (origin && e.origin !== origin) return;
        fr3.style.height = h + 'px';
        if (!fr3.style.transition) fr3.style.transition = 'height 0.15s ease';
    });

    /* ---------- Re-trigger height đo lại khi viewport theme đổi ---------- */
    var reflowDebounce = null;

    function pingAllFrames() {
        if (reflowDebounce) clearTimeout(reflowDebounce);
        reflowDebounce = setTimeout(function() {
            reflowDebounce = null;
            var ifs = document.getElementsByTagName('iframe');
            for (var i = 0; i < ifs.length; i++) {
                try {
                    var fr = ifs[i];
                    var src = fr.getAttribute('src') || '';
                    if (src.indexOf('widget-frame.html') === -1) continue;
                    if (fr.contentWindow) fr.contentWindow.postMessage({ type: 'wg-request-height' }, '*');
                } catch (e) {}
            }
        }, 120);
    }
    window.addEventListener('resize', pingAllFrames, { passive: true });
    window.addEventListener('orientationchange', function() {
        setTimeout(pingAllFrames, 100);
        setTimeout(pingAllFrames, 400);
    }, { passive: true });
})();