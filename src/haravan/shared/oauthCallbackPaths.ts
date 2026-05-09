export const HARAVAN_OAUTH_CALLBACK_PATH = '/api/haravan/oauth/callback';

export function isOAuthCallbackPath(pathname: string): boolean {
  return pathname === HARAVAN_OAUTH_CALLBACK_PATH || pathname === '/api/auth/callback';
}
