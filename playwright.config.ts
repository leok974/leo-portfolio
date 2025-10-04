import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Assumptions / overrides via env
const isCI = !!process.env.CI;
const workers = process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : undefined;
const baseURL = process.env.BASE_URL ?? process.env.BASE ?? process.env.PROD_BASE ?? 'http://127.0.0.1:8080';

// Reporter: line locally; html + line in CI (keeps local output light)
const reporter = (isCI ? [['html'], ['line']] : [['line']]) as any;

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: isCI,
  fullyParallel: true,
  workers,
  retries: isCI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 3_000 },
  globalSetup: path.resolve(__dirname, 'tests/e2e/global-setup.ts'),
  reporter,
  use: {
    headless: true,
    baseURL,
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PW_SKIP_WS ? undefined : {
    command: process.env.WS_CMD ?? (process.env.USE_DEV ? 'pnpm run dev' : 'pnpm run preview'),
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
