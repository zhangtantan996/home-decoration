import path from 'node:path';

import { defineConfig, loadEnv } from 'vite';

const legalPageSlugs = [
  'merchant-rules',
  'user-agreement',
  'privacy-policy',
  'personal-info-collection-list',
  'transaction-rules',
  'refund-rules',
  'third-party-sharing',
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const enablePolling = ['1', 'true', 'yes'].includes(
    String(env.VITE_DEV_WATCH_POLLING || process.env.VITE_DEV_WATCH_POLLING || '').trim().toLowerCase(),
  );

  return {
    root: '.',
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          ...Object.fromEntries(
            legalPageSlugs.map((slug) => [
              `legal-${slug}`,
              path.resolve(__dirname, `legal/${slug}/index.html`),
            ]),
          ),
        },
      },
    },
    server: {
      port: 5175,
      open: false,
      // Needed for local-gateway reverse proxy (Host header will be container name like "website").
      allowedHosts: ['website', 'localhost', '127.0.0.1'],
      fs: {
        allow: [path.resolve(__dirname, '..')],
      },
      watch: enablePolling ? {
        usePolling: true,
        interval: 250,
        awaitWriteFinish: {
          stabilityThreshold: 350,
          pollInterval: 100,
        },
      } : undefined,
    },
  };
});
