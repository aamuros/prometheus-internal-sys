import { fileURLToPath, URL } from 'node:url';
import { getRequestListener } from '@hono/node-server';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import type { Connect, Plugin } from 'vite';
import handler from './api/index.ts';
import vercelConfig from './vercel.json' with { type: 'json' };

// Local Node middleware uses the same fetch handler as the Vercel Function.
function localApi(): Plugin {
  function middleware(fetch: typeof handler.fetch): Connect.NextHandleFunction {
    const listener = getRequestListener(fetch);
    return (request, response, next) => {
      if (/^\/api(?:[/?]|$)/.test(request.url ?? '')) {
        void listener(request, response);
      } else {
        next();
      }
    };
  }

  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(
        middleware(async (request) => {
          const module = await server.ssrLoadModule('/api/index.ts');
          const api: typeof handler = module['default'];
          return api.fetch(request);
        }),
      );
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(handler.fetch));
    },
  };
}

export default defineConfig(({ mode }) => {
  // Unprefixed secrets stay in Node; Vite exposes only VITE_* to the browser.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    process.env[key] ??= value;
  }

  return {
    plugins: [react(), tailwindcss(), localApi()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    preview: {
      headers: Object.fromEntries(
        vercelConfig.headers.flatMap(({ headers }) =>
          headers.map(({ key, value }) => [key, value]),
        ),
      ),
    },
  };
});
