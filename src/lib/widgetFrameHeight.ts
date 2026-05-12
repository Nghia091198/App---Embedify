/**
 * Logic đo chiều cao embed — giữ khớp với public/widget-frame.html (measureHeight).
 * Dùng trong unit test; khi sửa công thức, cập nhật cả file HTML.
 */
export function computeWidgetEmbedContentHeight(input: {
  rootScrollHeight: number;
  documentElementScrollHeight: number;
  bodyScrollHeight: number;
  /** Mặc định 80 — khớp widget-frame */
  minHeight?: number;
}): number {
  const m = input.minHeight ?? 80;
  return Math.ceil(
    Math.max(input.rootScrollHeight, input.documentElementScrollHeight, input.bodyScrollHeight, m),
  );
}

export function parseWidgetResizePayload(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.type !== 'wg-widget-frame-resize' && d.type !== 'wg-resize') return null;
  const h = d.height;
  if (typeof h !== 'number' || !Number.isFinite(h)) return null;
  return Math.max(80, Math.floor(h));
}
