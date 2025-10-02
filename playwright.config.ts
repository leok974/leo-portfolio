import { defineConfig, devices } from '@playwright/test';

// Allow overriding via BASE for local/ui-smoke, fall back to existing prod URL
const BASE = process.env.BASE || process.env.PROD_BASE || 'http://127.0.0.1:8080';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  retries: 1,
  reporter: [ ['list'], ['html', { open: 'never' }] ],
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    ignoreHTTPSErrors: true,
    ...devices['Desktop Chrome']
  }
});
