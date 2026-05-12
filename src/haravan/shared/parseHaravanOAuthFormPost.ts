export interface OAuthFormBody {
  code?: string;
  id_token?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

/** Haravan OIDC form_post: key đôi khi khác casing — normalize. */
function pickString(b: Record<string, unknown>, ...keys: string[]): string | undefined {
  const lower = new Map<string, string>();
  for (const [k, v] of Object.entries(b)) {
    if (typeof v === 'string' && v.length > 0) lower.set(k.toLowerCase(), v);
  }
  for (const key of keys) {
    const v = lower.get(key.toLowerCase());
    if (v) return v;
  }
  return undefined;
}

export function parseOAuthFormBody(body: unknown): OAuthFormBody {
  if (!body || typeof body !== 'object') return {};
  const b = body as Record<string, unknown>;
  return {
    code: pickString(b, 'code'),
    id_token: pickString(b, 'id_token', 'idtoken'),
    state: pickString(b, 'state'),
    error: pickString(b, 'error'),
    error_description: pickString(b, 'error_description'),
  };
}
