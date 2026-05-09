import type { Request, Response } from 'express';
import express from 'express';
import { dispatchWebhook } from './registry.js';
import { verifyHaravanWebhook, verifyHubToken } from './verify.js';

export function createWebhookRouter(): express.Router {
  const router = express.Router();

  router.get('/', (req, res) => {
    const mode = (req.query['hub.mode'] as string)?.trim();
    const token = (req.query['hub.verify_token'] as string)?.trim() ?? '';
    const challenge = (req.query['hub.challenge'] as string)?.trim() ?? '';
    if (mode === 'subscribe') {
      if (verifyHubToken(token)) res.status(200).type('text/plain').send(challenge);
      else res.status(401).send('Forbidden');
      return;
    }
    res.status(200).json({ ok: true, service: 'haravan-widget-webhook' });
  });

  router.post(
    /^\/.*$/,
    express.json({
      verify: (req: Request & { rawBody?: Buffer }, _res, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
    (req: Request & { rawBody?: Buffer }, res: Response) => {
      res.status(200).json({ received: true });
      if (!verifyHaravanWebhook(req)) return;
      const topic = (req.get('X-Haravan-Topic') ?? '').toLowerCase() || 'unknown';
      void dispatchWebhook(topic, req, res).catch(() => {});
    },
  );

  return router;
}
