import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const enablePolling = ['1', 'true', 'yes'].includes(
    String(env.VITE_DEV_WATCH_POLLING || process.env.VITE_DEV_WATCH_POLLING || '').trim().toLowerCase(),
  );

  return {
    root: '.',
    build: {
      outDir: 'dist',
    },
    server: {
      port: 5175,
      open: false,
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
