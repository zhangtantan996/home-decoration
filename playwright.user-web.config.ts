import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['user-web-smoke.test.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.WEB_BASE_URL || 'http://127.0.0.1:5176',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'cd web && VITE_API_URL=http://127.0.0.1:8080/api/v1 VITE_ROUTER_BASENAME=/app npm run dev -- --host 127.0.0.1 --port 5176',
    url: 'http://127.0.0.1:5176',
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
