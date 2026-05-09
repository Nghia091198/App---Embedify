import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Connect } from 'vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function shouldForwardToBackend(pathname: string): boolean {
  return pathname.startsWith('/api/') || pathname.startsWith('/hook');
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
          server.middlewares.use(backendMiddleware());
        },
        configurePreviewServer(server) {
          server.middlewares.use(backendMiddleware());
        },
      },
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    preview: {
      port: 8080,
      host: true,
    },
    build: {
      outDir: 'dist',
    },
  };
});
