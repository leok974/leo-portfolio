import { defineConfig } from '@playwright/test';

const BASE = process.env.PROD_BASE || 'https://assistant.ledger-mind.org';

export default defineConfig({
  timeout: 30_000,
  testDir: 'tests/e2e',
  retries: 0,
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    ignoreHTTPSErrors: true,
  },
  reporter: [ ['list'], ['html', { open: 'never' }] ]
});
