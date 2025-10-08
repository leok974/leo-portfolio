import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Assumptions / overrides via env
const isCI = !!process.env.CI;
const workers = process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : undefined;
const baseURL = process.env.BASE_URL ?? process.env.BASE ?? process.env.PROD_BASE ?? 'http://127.0.0.1:5173';

// Reporter: line locally; html + line in CI (keeps local output light)
const reporter = (isCI ? [['html'], ['line']] : [['line']]) as any;

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: isCI,
  fullyParallel: true,
  workers,
  retries: isCI ? 2 : 0, // 2 retries in CI for flaky network/timing issues
  timeout: 30_000,
  expect: { timeout: 3_000 },
  globalSetup: path.resolve(__dirname, 'tests/e2e/global-setup.ts'),
  reporter,
  use: {
    headless: true,
    baseURL,
    trace: isCI ? 'on-first-retry' : 'retain-on-failure', // Lighter trace in CI
    video: isCI ? 'on-first-retry' : 'off', // Video only on retry in CI
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000, // Can override lower for @ui-polish tests
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-ui-polish',
      testMatch: /.*@ui-polish.*/,
      use: {
        ...devices['Desktop Chrome'],
        navigationTimeout: 10_000, // Lower timeout for CSS/UX tests
      },
    },
  ],
  webServer: process.env.PW_SKIP_WS ? undefined : {
    command: 'pnpm exec vite preview --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
