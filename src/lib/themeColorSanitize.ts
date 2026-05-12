/** Lưu vào widget_config / inline CSS — chặn injection. */
export function sanitizeThemeColorCss(raw: unknown): string {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  if (/[;{}<>]/.test(s)) return '';
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(s)) return s;
  if (/^rgba?\([^)]*\)$/i.test(s) && !/url\s*\(/i.test(s)) return s.replace(/\s+/g, ' ');
  return '';
}
