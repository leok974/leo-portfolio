import { defineConfig, devices } from '@playwright/test';

const PW_BASE_URL = process.env.PW_BASE_URL || 'http://127.0.0.1:4173';
const PW_SKIP_WS  = process.env.PW_SKIP_WS === '1';

/**
 * Simple Playwright config for portfolio E2E tests
 * No backend API required - just frontend tests
 */
export default defineConfig({
  testDir: 'tests/e2e/portfolio',
  forbidOnly: false,
  fullyParallel: true,
  workers: 4,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list']],

  // ✅ Use env baseURL everywhere
  use: {
    headless: true,
    baseURL: PW_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    viewport: { width: 1280, height: 1600 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // ✅ Only start a local server when we *don't* skip it
  ...(PW_SKIP_WS
    ? {}
    : {
        webServer: {
          command: 'npm run preview:portfolio',
          url: 'http://127.0.0.1:4173',     // only used when not skipping
          reuseExistingServer: true,
          timeout: 120_000,
        }
      }),
});
