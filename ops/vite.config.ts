import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const normalizeRouterBasename = (raw: string | undefined): string => {
  const value = (raw ?? '').trim();
  if (!value || value === '/') return '/';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appEnv = (env.VITE_APP_ENV ?? mode).trim().toLowerCase();
  const configuredBasename = normalizeRouterBasename(env.VITE_ROUTER_BASENAME);
  const routerBasename = configuredBasename !== '/' ? configuredBasename : (appEnv === 'production' ? '/ops' : '/');
  const base = routerBasename === '/' ? '/' : `${routerBasename}/`;
  const apiProxyTarget = (env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8080').trim();

  return {
    base,
    plugins: [react()],
    server: {
      host: true,
      port: 5179,
      allowedHosts: ['ops', 'localhost', '127.0.0.1'],
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '/static': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
