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
  retries: isCI ? 2 : 1, // 1 retry locally, 2 in CI for flaky network/timing issues
  timeout: 60_000, // Increased to 60s for slower operations
  expect: { timeout: 5_000 },
  globalSetup: path.resolve(__dirname, 'tests/e2e/setup/dev-overlay.ui.setup.ts'),
  reporter,
  use: {
    headless: true,
    baseURL,
    trace: 'on-first-retry', // Always capture trace on retry
    video: 'retain-on-failure', // Keep videos for failed tests
    screenshot: 'only-on-failure',
    actionTimeout: 15_000, // Increased action timeout
    navigationTimeout: 30_000, // Increased navigation timeout
    ignoreHTTPSErrors: true,
    storageState: process.env.PW_STATE || 'tests/e2e/.auth/dev-overlay-state.json',
    extraHTTPHeaders: {
      // All APIRequestContext calls will include this header
      // Enables dev auth for /agent/* routes in tests
      'Authorization': 'Bearer dev',
    },
  },
  projects: [
    // Setup project that creates auth state for dev overlay tests
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: [], // Don't depend on setup by default
    },
    {
      name: 'chromium-dev-overlay',
      testMatch: /(dev-overlay\.(session|expiry)\.spec\.ts|seo-pr-(persist|disabled-when-no-diff|copy-toast|localstorage-persist|storage-badge)\.spec\.ts)/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.resolve(__dirname, 'playwright/.auth/dev-overlay.json'),
      },
      dependencies: ['setup'], // Run setup first
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
    // Use dev server (not preview) - has proxy for /agent/* -> backend
    // No build needed for E2E - dev serves from source with proxy
    command: 'pnpm exec vite --port 5173 --strictPort --host',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
