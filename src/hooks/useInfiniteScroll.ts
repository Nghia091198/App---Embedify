import { useCallback, useEffect, useRef } from 'react';

export function useInfiniteScroll(enabled: boolean, onLoadMore: () => void, hasMore: boolean) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const cb = useCallback(() => {
    if (hasMore) onLoadMore();
  }, [hasMore, onLoadMore]);

  useEffect(() => {
    if (!enabled) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cb();
      },
      { root: null, rootMargin: '120px', threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [enabled, cb]);

  return sentinelRef;
}
