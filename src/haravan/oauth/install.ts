import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { saveOAuthState } from '../../db/sessionStore.js';

export const HARAVAN_SCOPES =
  'openid profile email org userinfo offline_access grant_service wh_api com.read_shop com.read_products com.write_products web.read_contents web.write_contents web.read_script_tags com.write_script_tags';

export async function installHandler(req: Request, res: Response): Promise<void> {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');
    await saveOAuthState(state, nonce, new Date(Date.now() + 10 * 60_000));
    const redirectUri = process.env.HARAVAN_REDIRECT_URI?.trim();
    const clientId = process.env.HARAVAN_CLIENT_ID?.trim();
    if (!redirectUri || !clientId) {
      res.status(500).type('text/plain').send('Missing HARAVAN_CLIENT_ID or HARAVAN_REDIRECT_URI');
      return;
    }
    const u = new URL('https://accounts.haravan.com/connect/authorize');
    u.searchParams.set('client_id', clientId);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('response_mode', 'form_post');
    u.searchParams.set('response_type', 'code id_token');
    u.searchParams.set('scope', HARAVAN_SCOPES);
    u.searchParams.set('state', state);
    u.searchParams.set('nonce', nonce);
    if (typeof req.query.orgid === 'string') u.searchParams.set('orgid', req.query.orgid);
    res.redirect(u.toString());
  } catch {
    res.status(500).type('text/plain').send('oauth_state_error');
  }
}
