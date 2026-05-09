export interface OAuthFormBody {
  code?: string;
  id_token?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

export function parseOAuthFormBody(body: unknown): OAuthFormBody {
  if (!body || typeof body !== 'object') return {};
  const b = body as Record<string, unknown>;
  return {
    code: typeof b.code === 'string' ? b.code : undefined,
    id_token: typeof b.id_token === 'string' ? b.id_token : undefined,
    state: typeof b.state === 'string' ? b.state : undefined,
    error: typeof b.error === 'string' ? b.error : undefined,
    error_description: typeof b.error_description === 'string' ? b.error_description : undefined,
  };
}
