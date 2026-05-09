import crypto from 'node:crypto';
import type { Request } from 'express';

export function verifyHubToken(hubVerifyToken: string): boolean {
  const expected = process.env.HARAVAN_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!expected) return process.env.NODE_ENV !== 'production';
  return hubVerifyToken === expected;
}

export function verifyHaravanWebhook(req: Request & { rawBody?: Buffer }): boolean {
  const secret = process.env.HARAVAN_CLIENT_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  const hmacHeader = req.get('X-Haravan-Hmacsha256') ?? req.get('x-haravan-hmacsha256');
  if (!hmacHeader) return false;
  const digest = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody ?? Buffer.from(''))
    .digest('base64');
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader.trim());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
