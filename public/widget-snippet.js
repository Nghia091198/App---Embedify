(function () {
  'use strict';

  var SELECTORS = [
    '[data-wg-content]',
    '.product-description',
    '.product__description',
    '.article-content',
    '.article__content',
    '.page-content',
    '.page__content',
    '[class*="description"]',
    '[class*="content"]',
    'article',
    'main',
  ];

  var SWIPER_CSS_URL = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css';
  var SWIPER_JS_URL = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';
  var STYLE_ID = 'wg-styles';
  var SCRIPT_ID = 'wg-swiper-js';
  var LINK_ID = 'wg-swiper-css';

  try {
    var meta = document.querySelector('meta[name="wg-content"]');
    if (!meta) return;

    var contentType = (meta.getAttribute('data-type') || '').trim();
    var contentId = (meta.getAttribute('data-id') || '').trim();
    var orgId = (meta.getAttribute('data-org') || '').trim();
    var appOrigin = (meta.getAttribute('data-app') || '').trim().replace(/\/+$/, '');

    if (!contentType || !contentId || !orgId || !appOrigin) {
      console.warn('[wg] Missing required meta attributes.');
      return;
    }

    injectBaseStylesOnce();

    var q = new URLSearchParams({
      content_type: contentType,
      content_id: contentId,
      org_id: orgId,
    });

    fetch(appOrigin + '/api/widget/blocks?' + q.toString())
      .then(function (res) {
        if (!res.ok) throw new Error('blocks_fetch_failed_' + res.status);
        return res.json();
      })
      .then(function (payload) {
        if (!payload || !Array.isArray(payload.blocks) || payload.blocks.length === 0) return;

        var container = findContentContainer();
        if (!container) {
          console.warn('[wg] Content container not found.');
          return;
        }

        var blocks = sortBlocksForStableInjection(payload.blocks);

        if (payload.has_slider === true) {
          loadSwiper(function () {
            injectAndInit(container, blocks);
          });
          return;
        }

        injectAndInit(container, blocks);
      })
      .catch(function (err) {
        console.warn('[wg] Failed to load/inject blocks.', err);
      });
  } catch (err) {
    console.warn('[wg] Unexpected snippet error.', err);
  }

  function injectBaseStylesOnce() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.wg-block{margin:24px 0;}' +
      '.wg-block--grid .wg-grid{display:grid;gap:12px;}' +
      '.wg-grid.wg-cols-3{grid-template-columns:repeat(3,1fr);}' +
      '.wg-grid.wg-cols-4{grid-template-columns:repeat(4,1fr);}' +
      '.wg-grid.wg-cols-5{grid-template-columns:repeat(5,1fr);}' +
      '@media (max-width:767px){' +
      '.wg-grid.wg-cols-m-1{grid-template-columns:repeat(1,1fr);}' +
      '.wg-grid.wg-cols-m-2{grid-template-columns:repeat(2,1fr);}' +
      '}' +
      '.wg-card{border-radius:8px;overflow:hidden;background:#fff;border:1px solid #e2e8f0;}' +
      '.wg-img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;}' +
      '.wg-img--placeholder{background:#f1f5f9;width:100%;aspect-ratio:1/1;}' +
      '.wg-body{padding:8px;}' +
      '.wg-title{font-size:13px;font-weight:600;color:#0f172a;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}' +
      '.wg-price{font-size:13px;color:#1d9e75;font-weight:700;margin-top:4px;}' +
      '.wg-actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;}' +
      '.wg-btn{flex:1;padding:6px 8px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:none;}' +
      '.wg-btn--cart{background:#1d9e75;color:#fff;}' +
      '.wg-btn--cart:hover{background:#15805e;}' +
      '.wg-btn--qv{background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;}' +
      '.wg-btn--qv:hover{background:#e2e8f0;}' +
      '.wg-block--slider .wg-slider{width:100%;}' +
      '.wg-block--slider .wg-card{height:100%;}';
    document.head.appendChild(style);
  }

  function findContentContainer() {
    for (var i = 0; i < SELECTORS.length; i += 1) {
      var found = document.querySelector(SELECTORS[i]);
      if (found) return found;
    }
    return null;
  }

  function sortBlocksForStableInjection(blocks) {
    function positionRank(position) {
      if (position === 'start') return 0;
      if (position === 'end') return 2;
      if (typeof position === 'string' && position.indexOf('after_p_') === 0) return 1;
      return 2;
    }

    function afterIndex(position) {
      if (typeof position !== 'string' || position.indexOf('after_p_') !== 0) return Number.MAX_SAFE_INTEGER;
      var n = parseInt(position.replace('after_p_', ''), 10);
      return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
    }

    var sorted = blocks.slice().sort(function (a, b) {
      var aPos = a && a.position;
      var bPos = b && b.position;
      var ra = positionRank(aPos);
      var rb = positionRank(bPos);
      if (ra !== rb) return ra - rb;
      if (ra === 1) return afterIndex(aPos) - afterIndex(bPos);
      return 0;
    });

    return sorted.reverse();
  }

  function injectAndInit(container, blocks) {
    var injected = [];

    for (var i = 0; i < blocks.length; i += 1) {
      var block = blocks[i];
      if (!block || typeof block.html !== 'string') continue;

      var wrapper = document.createElement('div');
      wrapper.innerHTML = block.html;
      injectBlockByPosition(container, wrapper, block.position);
      injected.push({ block: block, el: wrapper });
    }

    for (var j = 0; j < injected.length; j += 1) {
      var item = injected[j];
      if (!item || !item.block || item.block.display_type !== 'slider') continue;
      initSwiper(item.el, item.block);
    }
  }

  function injectBlockByPosition(container, el, position) {
    if (position === 'start') {
      container.insertBefore(el, container.firstChild);
      return;
    }

    if (position === 'end') {
      container.appendChild(el);
      return;
    }

    if (typeof position === 'string' && position.indexOf('after_p_') === 0) {
      var n = parseInt(position.replace('after_p_', ''), 10);
      var paragraphs = container.querySelectorAll(':scope > p');
      var target = Number.isFinite(n) ? paragraphs[n - 1] : null;
      if (target) {
        target.after(el);
      } else {
        container.appendChild(el);
      }
      return;
    }

    container.appendChild(el);
  }

  function initSwiper(rootEl, block) {
    try {
      var swiperEl = rootEl.querySelector('.swiper');
      if (!swiperEl || !window.Swiper) return;
      var mobile = Number(block.slider_mobile_count || 1.5);
      var desktop = Number(block.slider_desktop_count || 4);
      // eslint-disable-next-line no-new
      new window.Swiper(swiperEl, {
        slidesPerView: mobile,
        spaceBetween: 12,
        breakpoints: {
          768: {
            slidesPerView: desktop,
            spaceBetween: 16,
          },
        },
      });
    } catch (err) {
      console.warn('[wg] Failed to init swiper.', err);
    }
  }

  function loadSwiper(done) {
    if (window.Swiper) {
      done();
      return;
    }

    if (!document.getElementById(LINK_ID)) {
      var css = document.createElement('link');
      css.id = LINK_ID;
      css.rel = 'stylesheet';
      css.href = SWIPER_CSS_URL;
      document.head.appendChild(css);
    }

    var existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      if (existing.getAttribute('data-loaded') === '1') {
        done();
      } else {
        existing.addEventListener('load', done, { once: true });
      }
      return;
    }

    var js = document.createElement('script');
    js.id = SCRIPT_ID;
    js.src = SWIPER_JS_URL;
    js.async = true;
    js.onload = function () {
      js.setAttribute('data-loaded', '1');
      done();
    };
    js.onerror = function () {
      console.warn('[wg] Failed to load Swiper JS.');
    };
    document.head.appendChild(js);
  }
})();
