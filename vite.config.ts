import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Connect, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { isOAuthCallbackPath } from './src/haravan/shared/oauthCallbackPaths';
import { parseOAuthCallbackRawBody } from './src/haravan/shared/parseOAuthCallbackBody';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function shouldForwardToBackend(pathname: string): boolean {
  return pathname.startsWith('/api/') || pathname.startsWith('/hook');
}

function widgetPublicAssetCacheMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url ?? '';
    const pathname = url.split('?')[0] ?? '';
    if (pathname === '/widget-snippet.js' || pathname === '/widget-frame.html') {
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    }
    next();
  };
}

/** Đọc body POST callback trước plugin khác — tránh stream bị tiêu thụ trước khi tới Express (theo PrejectSEO_ver2). */
function haravanOAuthBodyPrePlugin(): Plugin {
  /** Dev & preview đều có `middlewares` kiểu Connect — không dùng `Plugin['configureServer']` cho cả hai (PreviewServer ≠ ViteDevServer). */
  const attach = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use(
      (
        req: import('http').IncomingMessage & { body?: Record<string, string> },
        _res: unknown,
        next: (err?: Error) => void,
      ) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        const pathname = req.url?.split('?')[0] ?? '';
        if (!isOAuthCallbackPath(pathname)) {
          next();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > 512 * 1024) {
            next(new Error('OAuth callback body too large'));
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
      },
    );
  };
  return {
    name: 'haravan-oauth-body-connect-pre',
    enforce: 'pre',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

/**
 * Không static-import `./src/haravan` trong vite.config — load env (defineConfig) chạy sau khi file config được bundle;
 * import tĩnh kéo `db/client` → Supabase ném trước khi có biến môi trường.
 * Dynamic import trong middleware chạy sau khi Vite đã merge `.env` vào `process.env`.
 */
function widgetBackendPlugin(): Plugin {
  return {
    name: 'widget-backend',
    configureServer(server) {
      let authApp: Connect.NextHandleFunction | undefined;

      server.middlewares.use(widgetPublicAssetCacheMiddleware());

      server.middlewares.use(async (req, res, next) => {
        try {
          if (req.method !== 'GET') {
            next();
            return;
          }
          const pathname = req.url?.split('?')[0] ?? '';
          if (!isOAuthCallbackPath(pathname)) {
            next();
            return;
          }
          const indexPath = path.resolve(__dirname, 'index.html');
          let html = await fs.readFile(indexPath, 'utf-8');
          html = await server.transformIndexHtml(req.url || pathname, html);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (err) {
          next(err as Error);
        }
      });

      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? '/';
        if (!shouldForwardToBackend(pathname)) {
          next();
          return;
        }
        void (async () => {
          try {
            if (!authApp) {
              const mod = await import('./src/server/app');
              authApp = mod.createBackendApp() as Connect.NextHandleFunction;
            }
            void authApp(req, res, next);
          } catch (e) {
            next(e);
          }
        })();
      });
    },
    configurePreviewServer(server) {
      let authApp: Connect.NextHandleFunction | undefined;

      server.middlewares.use(widgetPublicAssetCacheMiddleware());

      server.middlewares.use(async (req, res, next) => {
        try {
          if (req.method !== 'GET') {
            next();
            return;
          }
          const pathname = req.url?.split('?')[0] ?? '';
          if (!isOAuthCallbackPath(pathname)) {
            next();
            return;
          }
          const distIndex = path.resolve(__dirname, 'dist/index.html');
          const html = await fs.readFile(distIndex, 'utf-8');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch {
          next();
        }
      });

      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? '/';
        if (!shouldForwardToBackend(pathname)) {
          next();
          return;
        }
        void (async () => {
          try {
            if (!authApp) {
              const mod = await import('./src/server/app');
              authApp = mod.createBackendApp() as Connect.NextHandleFunction;
            }
            void authApp(req, res, next);
          } catch (e) {
            next(e);
          }
        })();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [haravanOAuthBodyPrePlugin(), widgetBackendPlugin(), react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    server: {
      allowedHosts: true,
    },
    preview: {
      port: 8090,
      host: true,
      allowedHosts: true,
    },
    build: {
      outDir: 'dist',
    },
  };
});
