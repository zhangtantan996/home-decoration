import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const normalizeRouterBasename = (raw: string | undefined): string => {
  const value = (raw ?? '').trim();
  if (!value || value === '/') {
    return '/';
  }

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appEnv = (env.VITE_APP_ENV ?? '').trim().toLowerCase();
  const configuredBasename = normalizeRouterBasename(env.VITE_ROUTER_BASENAME);
  const routerBasename = configuredBasename !== '/' ? configuredBasename : (appEnv === 'production' ? '/merchant' : '/');

  return {
    base: routerBasename === '/' ? '/' : `${routerBasename}/`,
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 4000,
    },
    server: {
      host: true,
      port: 5174,
    },
  };
});
