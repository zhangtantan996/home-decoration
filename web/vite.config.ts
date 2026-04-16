import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rawBase = (env.VITE_ROUTER_BASENAME || '/').trim();
  const normalizedBase = rawBase === '/' ? '/' : `/${rawBase.replace(/^\/+|\/+$/g, '')}/`;
  const apiBase = (env.VITE_API_URL || '/api/v1').trim();
  const proxyTarget = (env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8080').trim().replace(/\/+$/, '');
  const useRelativeApiProxy = apiBase.startsWith('/');
  const enablePolling = ['1', 'true', 'yes'].includes(
    String(env.VITE_DEV_WATCH_POLLING || process.env.VITE_DEV_WATCH_POLLING || '').trim().toLowerCase(),
  );

  return {
    base: normalizedBase,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      host: true,
      port: 5176,
      watch: enablePolling ? {
        usePolling: true,
        interval: 250,
        awaitWriteFinish: {
          stabilityThreshold: 350,
          pollInterval: 100,
        },
      } : undefined,
      proxy: useRelativeApiProxy ? {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
        },
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/static': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/tinode': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
        },
        '/v0': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
        },
      } : undefined,
      fs: {
        allow: [path.resolve(__dirname, '..')],
      },
    },
    preview: {
      host: true,
      port: 4176,
    },
  };
});
