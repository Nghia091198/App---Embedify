import type { NextFunction, Request, Response } from 'express';
import { parseOAuthCallbackRawBody } from './parseOAuthCallbackBody.js';

const MAX_BYTES = 512 * 1024;

/**
 * Haravan OIDC form_post: Content-Type lệch → `express.urlencoded` / `express.text` có thể không set `req.body`.
 * Đọc raw POST và parse như form-urlencoded. Nếu Vite pre-plugin đã gắn `req.body` thì bỏ qua.
 */
export function haravanOAuthRawBodyMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return (req, _res, next) => {
    if (req.method !== 'POST') {
      next();
      return;
    }

    const existing = req.body;
    if (
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing) &&
      Object.keys(existing as object).length > 0
    ) {
      next();
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        next(new Error('OAuth callback body exceeds size limit'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        req.body = parseOAuthCallbackRawBody(raw);
        next();
      } catch (e) {
        next(e instanceof Error ? e : new Error(String(e)));
      }
    });

    req.on('error', next);
  };
}
