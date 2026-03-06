import { defineConfig, devices } from '@playwright/test';

const baseApiOrigin = process.env.API_BASE_URL || 'http://localhost:8080';
const apiBaseUrl = process.env.E2E_API_BASE_URL || `${baseApiOrigin.replace(/\/$/, '')}/api/v1`;
const adminOrigin = process.env.E2E_ADMIN_ORIGIN || process.env.ADMIN_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e/identity',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results/identity-playwright',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'identity-api',
      testMatch: '**/api.identity.acceptance.spec.ts',
      use: {
        baseURL: apiBaseUrl,
      },
    },
    {
      name: 'identity-admin-ui',
      testMatch: '**/admin.identity.acceptance.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: adminOrigin,
      },
    },
  ],
});
