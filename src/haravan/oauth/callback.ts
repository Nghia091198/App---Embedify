import type { Request, Response } from 'express';
import { logger } from '../../lib/logger.js';
import { consumeOAuthState, upsertHaravanSession } from '../../db/sessionStore.js';
import { SESSION_COOKIE } from '../authMiddleware.js';
import { parseOAuthFormBody } from '../shared/parseHaravanOAuthFormPost.js';
import { subscribeWebhook } from '../webhook/subscribeApi.js';
import { decodeJwtPayload } from '../../lib/jwtPayload.js';
import { createScriptTag, getShopDomain, purgeWidgetScriptTags } from '../../lib/haravanApi.js';

async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
  scope?: string;
} | null> {
  const clientId = process.env.HARAVAN_CLIENT_ID?.trim();
  const clientSecret = process.env.HARAVAN_CLIENT_SECRET?.trim();
  const redirectUri = process.env.HARAVAN_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch('https://accounts.haravan.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    console.error('[callback] token exchange failed', res.status, await res.text().catch(() => ''));
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  if (!data?.access_token) return null;
  return {
    access_token: String(data.access_token),
    refresh_token: data.refresh_token != null ? String(data.refresh_token) : undefined,
    id_token: data.id_token != null ? String(data.id_token) : undefined,
    expires_in: Number(data.expires_in ?? 86400),
    scope: data.scope != null ? String(data.scope) : undefined,
  };
}

export async function callbackHandler(req: Request, res: Response): Promise<void> {
  const appOrigin = process.env.APP_ORIGIN?.trim() || '/';
  const body = parseOAuthFormBody(req.body);

  if (body.error) {
    res.redirect(`${appOrigin}?auth_error=${encodeURIComponent(body.error)}`);
    return;
  }

  if (!body.code || !body.state) {
    const keys =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? Object.keys(req.body as object).join(',')
        : '';
    console.error('[callback] missing code/state', {
      contentType: req.headers['content-type'],
      bodyKeys: keys,
    });
    res.redirect(`${appOrigin}?auth_error=missing_params`);
    return;
  }

  const nonce = await consumeOAuthState(body.state);
  if (!nonce) {
    res.redirect(`${appOrigin}?auth_error=invalid_state`);
    return;
  }

  // id_token từ form post (Hybrid Flow) — optional
  const id1 = body.id_token ? decodeJwtPayload(body.id_token) : null;

  // Nếu có id_token trong form post thì verify nonce ngay
  if (id1 && String(id1.nonce ?? '') !== nonce) {
    res.redirect(`${appOrigin}?auth_error=nonce_mismatch`);
    return;
  }

  const tokens = await exchangeCode(body.code);
  if (!tokens) {
    res.redirect(`${appOrigin}?auth_error=token_exchange_failed`);
    return;
  }

  // id_token từ token exchange
  const id2 = tokens.id_token ? decodeJwtPayload(tokens.id_token) : null;

  // Nếu chỉ có id_token từ token exchange thì verify nonce ở đây
  if (!id1 && id2 && String(id2.nonce ?? '') !== nonce) {
    res.redirect(`${appOrigin}?auth_error=nonce_mismatch`);
    return;
  }

  const claims = id2 ?? id1;
  if (!claims) {
    console.error('[callback] no id_token from either form post or token exchange');
    res.redirect(`${appOrigin}?auth_error=no_id_token`);
    return;
  }

  const sub = String(claims.sub ?? '');
  if (!sub) {
    res.redirect(`${appOrigin}?auth_error=no_sub`);
    return;
  }

  const orgid = claims.orgid != null ? String(claims.orgid) : null;
  const orgname = claims.orgname != null ? String(claims.orgname) : null;
  const email = claims.email != null ? String(claims.email) : null;
  const name = claims.name != null ? String(claims.name) : null;
  const exp = new Date(Date.now() + tokens.expires_in * 1000);
  const shopDomain = await getShopDomain(tokens.access_token).catch(() => null);

  try {
    const sessionId = await upsertHaravanSession({
      user_sub: sub,
      user_email: email,
      user_name: name,
      orgid,
      orgname,
      access_token: tokens.access_token,
      id_token: tokens.id_token ?? body.id_token ?? null,
      refresh_token: tokens.refresh_token,
      token_expires_at: exp,
      scope: tokens.scope,
      shop_info: { orgid, orgname, shop_domain: shopDomain },
    });
    const secure = process.env.NODE_ENV === 'production';
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    subscribeWebhook(tokens.access_token).catch(() => {});

    logger.info('oauth success', {
      org_id: orgid,
      orgname: orgname ?? undefined,
    });

    /**
     * Tự động cài ScriptTag (URL cố định) ngay sau OAuth — merchant không cần vào
     * Thiết lập → Cài lại snippet. Fire-and-forget, không block redirect.
     */
    void (async () => {
      try {
        const envOrigin = process.env.APP_ORIGIN?.trim();
        const inferred = (() => {
          const xfHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
          const host = xfHost || req.get('host') || '';
          if (!host) return '';
          const xfProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
          const proto =
            xfProto === 'http' || xfProto === 'https' ? xfProto : (req.protocol === 'https' ? 'https' : 'http');
          return `${proto}://${host}`;
        })();
        const root = (envOrigin || inferred).replace(/\/$/, '');
        if (!root) return;
        await purgeWidgetScriptTags(tokens.access_token, root).catch(() => 0);
        await createScriptTag(tokens.access_token, `${root}/widget-snippet.js`);
      } catch (err) {
        console.warn('[callback] auto ScriptTag install failed:', err);
      }
    })();

    res.redirect(appOrigin);
  } catch (err) {
    console.error('[callback] session save failed', err);
    res.redirect(`${appOrigin}?auth_error=session_save_failed`);
  }
}