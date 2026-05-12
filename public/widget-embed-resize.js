/**
 * Chạy trên storefront Haravan (ScriptTag). Haravan thường xoá <script> trong body_html
 * nên iframe embed trong bài cần listener ở đây để nhận postMessage chỉnh chiều cao.
 */
(function () {
  'use strict';
  if (!window.__wgIframeResizeBound) {
    window.__wgIframeResizeBound = true;
    window.addEventListener('message', function (e) {
    if (!e.data || typeof e.data !== 'object') return;

    if (e.data.type === 'wg-add-to-cart') {
      console.warn('[wg] add-to-cart', e.data.productId);
      return;
    }
    if (e.data.type === 'wg-quick-view') {
      console.warn('[wg] quick-view', e.data.productId);
      return;
    }

    if (e.data.type !== 'wg-widget-frame-resize' && e.data.type !== 'wg-resize') return;
    if (typeof e.data.height !== 'number') return;

    var h = Math.max(80, e.data.height | 0);
    var iframes = document.getElementsByTagName('iframe');
    for (var i = 0; i < iframes.length; i++) {
      try {
        var fr = iframes[i];
        if (fr.contentWindow !== e.source) continue;
        var src = fr.getAttribute('src') || '';
        if (!src) continue;
        var expectedOrigin;
        try {
          expectedOrigin = new URL(src, window.location.href).origin;
        } catch (err) {
          continue;
        }
        if (e.origin !== expectedOrigin) continue;
        fr.style.height = h + 'px';
        if (!fr.style.transition) fr.style.transition = 'height 0.15s ease';
        break;
      } catch (e2) {}
    }
  });
  }

  if (!window.__wgParentReflowBound) {
    window.__wgParentReflowBound = true;
    var reflowDebounce = null;
    function requestAllWidgetFramesRemeasure() {
      if (reflowDebounce) clearTimeout(reflowDebounce);
      reflowDebounce = setTimeout(function () {
        reflowDebounce = null;
        var iframes = document.getElementsByTagName('iframe');
        for (var i = 0; i < iframes.length; i++) {
          try {
            var fr = iframes[i];
            var src = fr.getAttribute('src') || '';
            if (src.indexOf('widget-frame.html') === -1) continue;
            if (fr.contentWindow) {
              fr.contentWindow.postMessage({ type: 'wg-request-height' }, '*');
            }
          } catch (e3) {}
        }
      }, 120);
    }

    window.addEventListener('resize', requestAllWidgetFramesRemeasure, { passive: true });
    window.addEventListener(
      'orientationchange',
      function () {
        setTimeout(requestAllWidgetFramesRemeasure, 100);
        setTimeout(requestAllWidgetFramesRemeasure, 400);
      },
      { passive: true },
    );
    try {
      var mq = window.matchMedia('(max-width: 767px)');
      var onMq = function () {
        requestAllWidgetFramesRemeasure();
      };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
      else if (mq.addListener) mq.addListener(onMq);
    } catch (eMq) {}
  }
})();
