import { useEffect, useRef, type RefObject } from 'react';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Swiper?: any;
  }
}

let swiperLoaded = false;
let swiperLoading = false;
const pendingCallbacks: Array<() => void> = [];

function loadSwiperOnce(onReady: () => void): void {
  if (swiperLoaded && window.Swiper) {
    onReady();
    return;
  }
  pendingCallbacks.push(onReady);
  if (swiperLoading) return;
  swiperLoading = true;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css';
  document.head.appendChild(link);

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';
  script.onload = () => {
    swiperLoaded = true;
    swiperLoading = false;
    pendingCallbacks.splice(0).forEach((cb) => cb());
  };
  script.onerror = () => {
    swiperLoading = false;
  };
  document.head.appendChild(script);
}

/**
 * Sau mỗi lần previewHtml thay đổi: destroy Swiper cũ, init lại theo `.swiper[data-desktop]`.
 * `destroy(false, false)` — tránh Swiper gỡ DOM làm mất HTML React vừa gắn bằng dangerouslySetInnerHTML.
 */
export function useSwiperPreview(containerRef: RefObject<HTMLDivElement | null>, previewHtml: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instancesRef = useRef<any[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    instancesRef.current.forEach((sw) => {
      try {
        sw.destroy(false, false);
      } catch {
        /* ignore */
      }
    });
    instancesRef.current = [];

    const swiperEls = Array.from(container.querySelectorAll<HTMLElement>('.swiper[data-desktop]'));
    if (swiperEls.length === 0) return;

    let cancelled = false;

    loadSwiperOnce(() => {
      if (cancelled || !window.Swiper) return;
      swiperEls.forEach((el) => {
        const desktop = parseFloat(el.dataset.desktop ?? '4');
        const mobile = parseFloat(el.dataset.mobile ?? '1.5');
        const gapRaw = parseInt(el.dataset.gap ?? '12', 10);
        const gap = Number.isFinite(gapRaw) ? Math.min(48, Math.max(8, gapRaw)) : 12;
        const overflow = el.dataset.wgOverflow === '1';
        const nextEl = el.querySelector<HTMLElement>('.swiper-button-next');
        const prevEl = el.querySelector<HTMLElement>('.swiper-button-prev');
        const pagEl = el.querySelector<HTMLElement>('.swiper-pagination');
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sw = new (window.Swiper as any)(el, {
            slidesPerView: mobile,
            spaceBetween: gap,
            grabCursor: true,
            breakpoints: {
              768: { slidesPerView: desktop, spaceBetween: gap },
            },
            navigation:
              overflow && nextEl && prevEl
                ? {
                    nextEl,
                    prevEl,
                  }
                : undefined,
            pagination:
              overflow && pagEl
                ? {
                    el: pagEl,
                    clickable: true,
                    dynamicBullets: true,
                  }
                : undefined,
          });
          instancesRef.current.push(sw);
        } catch {
          /* ignore */
        }
      });
    });

    return () => {
      cancelled = true;
      instancesRef.current.forEach((sw) => {
        try {
          sw.destroy(false, false);
        } catch {
          /* ignore */
        }
      });
      instancesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ reinit khi HTML đổi
  }, [previewHtml]);
}
