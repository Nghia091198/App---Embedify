import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Connect } from 'vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function shouldForwardToBackend(pathname: string): boolean {
  return pathname.startsWith('/api/') || pathname.startsWith('/hook');
}

/**
 * Cache-Control cho file public phục vụ Haravan storefront:
 * - `widget-snippet.js`: ScriptTag URL cố định (không có ?v=). 5 phút cache để
 *   khi app deploy version mới, mọi shop tự nhận update trong tối đa ~5p.
 * - `widget-frame.html`: iframe src — UI có thể đổi, cũng dùng cache ngắn.
 */
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

function backendMiddleware(): Connect.NextHandleFunction {
  let app: Connect.NextHandleFunction | undefined;
  return (req, res, next) => {
    const url = req.url ?? '/';
    const pathname = url.split('?')[0] ?? '/';
    if (!shouldForwardToBackend(pathname)) {
      next();
      return;
    }
    void (async () => {
      try {
        if (!app) {
          const mod = await import('./src/server/app');
          app = mod.createBackendApp() as Connect.NextHandleFunction;
        }
        void app(req, res, next);
      } catch (e) {
        next(e);
      }
    })();
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [
      react(),
      {
        name: 'widget-backend',
        configureServer(server) {
          server.middlewares.use(widgetPublicAssetCacheMiddleware());
          server.middlewares.use(backendMiddleware());
        },
        configurePreviewServer(server) {
          server.middlewares.use(widgetPublicAssetCacheMiddleware());
          server.middlewares.use(backendMiddleware());
        },
      },
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    server: {
      allowedHosts: true,
    },
    preview: {
      port: 8080,
      host: true,
      allowedHosts: true,
    },
    build: {
      outDir: 'dist',
    },
  };
});
