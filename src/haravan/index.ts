import type { NextFunction, Request, RequestHandler, Response } from 'express';
import cookieParser from 'cookie-parser';
import express from 'express';
import { requestLogger } from '../server/requestLogger.js';
import type { HaravanRequest } from './authMiddleware.js';
import { loadHaravanSession } from './authMiddleware.js';
import { bindSupabaseHandler } from './oauth/bindSupabase.js';
import { callbackHandler } from './oauth/callback.js';
import { crawlerContextHandler } from './oauth/crawlerContext.js';
import { installHandler } from './oauth/install.js';
import { loginHandler } from './oauth/login.js';
import { logoutHandler } from './oauth/logout.js';
import { meHandler } from './oauth/me.js';
import { refreshHandler } from './oauth/refresh.js';
import { HARAVAN_OAUTH_CALLBACK_PATH } from './shared/oauthCallbackPaths.js';
import { createWebhookRouter } from './webhook/index.js';
import { subscribeWebhook, unsubscribeWebhook } from './webhook/subscribeApi.js';
import { registerWidgetRoutes } from '../widget/registerRoutes.js';

function asyncHandler(
  fn: (req: HaravanRequest, res: Response) => void | Promise<void>,
): (req: HaravanRequest, res: Response) => void {
  return (req, res) => {
    void Promise.resolve(fn(req, res)).catch(() => {
      if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
    });
  };
}

/**
 * Haravan hybrid `response_mode=form_post` — body là x-www-form-urlencoded.
 * Dùng `express.text` + URLSearchParams thay vì chỉ `urlencoded` để tránh
 * trường hợp Vite/Connect hoặc Content-Type có charset khiến `req.body` rỗng.
 */
const haravanOAuthFormPostParsers: RequestHandler[] = [
  express.text({ type: '*/*', limit: '2mb' }),
  (req: Request, _res: Response, next: NextFunction) => {
    if (typeof req.body === 'string' && req.body.length > 0) {
      const o: Record<string, string> = {};
      new URLSearchParams(req.body).forEach((value, key) => {
        o[key] = value;
      });
      req.body = o;
    } else if (req.body == null || typeof req.body !== 'object') {
      req.body = {};
    }
    next();
  },
];

export function createHaravanApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cookieParser());
  app.use(requestLogger);

  const auth = express.Router();
  auth.get('/install', (req, res) => void installHandler(req, res));
  auth.get('/login', loginHandler);
  auth.post('/callback', ...haravanOAuthFormPostParsers, (req, res) => void callbackHandler(req, res));
  auth.get('/me', loadHaravanSession, asyncHandler(meHandler));
  auth.get('/crawler-context', loadHaravanSession, asyncHandler(crawlerContextHandler));
  auth.post('/refresh', loadHaravanSession, asyncHandler(refreshHandler));
  auth.post('/logout', logoutHandler);
  auth.post('/bind-supabase', express.json(), loadHaravanSession, asyncHandler(bindSupabaseHandler));
  app.use('/api/auth', auth);
  app.post(HARAVAN_OAUTH_CALLBACK_PATH, ...haravanOAuthFormPostParsers, (req, res) =>
    void callbackHandler(req, res),
  );

  app.use('/hook', createWebhookRouter());

  app.post('/api/webhook/subscribe', loadHaravanSession, asyncHandler(subscribeHandler));
  app.delete('/api/webhook/subscribe', loadHaravanSession, asyncHandler(unsubscribeHandler));
  app.get('/api/webhook/status', loadHaravanSession, asyncHandler(webhookStatusHandler));

  registerWidgetRoutes(app);

  return app;
}

async function subscribeHandler(req: HaravanRequest, res: Response): Promise<void> {
  const token = req.haravanSession?.access_token;
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const ok = await subscribeWebhook(token);
  res.json({ ok });
}

async function unsubscribeHandler(req: HaravanRequest, res: Response): Promise<void> {
  const token = req.haravanSession?.access_token;
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const ok = await unsubscribeWebhook(token);
  res.json({ ok });
}

async function webhookStatusHandler(_req: HaravanRequest, res: Response): Promise<void> {
  res.json({ topics: ['app/uninstalled', 'shop/update'] });
}
