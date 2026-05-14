const MAX_RAW = 512 * 1024;

/** Parse Haravan OIDC form_post body (urlencoded); fallback JSON nếu body rỗng sau parse. */
export function parseOAuthCallbackRawBody(raw: string): Record<string, string> {
  if (raw.length > MAX_RAW) {
    throw new Error('OAuth callback raw body too large');
  }
  const trimmed = raw.trim();
  if (!trimmed) return {};

  const params = new URLSearchParams(trimmed);
  const body: Record<string, string> = {};
  for (const [k, v] of params) {
    body[k] = v;
  }
  if (Object.keys(body).length > 0) return body;

  if (trimmed.startsWith('{')) {
    try {
      const j = JSON.parse(trimmed) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(j)) {
        if (v == null) continue;
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          out[k] = String(v);
        }
      }
      return out;
    } catch {
      return {};
    }
  }
  return {};
}
