import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Assumptions / overrides via env
const isCI = !!process.env.CI;
const workers = process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : undefined;
const defaultPort = process.env.PW_APP === 'portfolio' ? '5174' : '5173';
const baseURL = process.env.PW_BASE_URL ?? process.env.BASE_URL ?? process.env.BASE ?? process.env.PROD_BASE ?? `http://127.0.0.1:${defaultPort}`;

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
  globalSetup: path.resolve(__dirname, 'tests/e2e/setup/dev-overlay.ui.setup.ts'),
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
    storageState: process.env.PW_STATE || 'tests/e2e/.auth/dev-overlay-state.json',
    viewport: { width: 1280, height: 1600 },
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
    // SiteAgent project: Vite preview on port 5173
    {
      name: 'siteagent',
      use: {
        baseURL: process.env.PW_BASE_URL ?? 'http://127.0.0.1:5173',
        ...devices['Desktop Chrome'],
      },
      grep: /@siteagent/,
      grepInvert: /@portfolio|@wip/,
      dependencies: [], // Don't depend on setup by default
    },
    // Portfolio project: nginx on port 8080 (full-stack)
    {
      name: 'portfolio',
      use: {
        baseURL: process.env.PW_EDGE_URL ?? 'http://127.0.0.1:8080',
        ...devices['Desktop Chrome'],
      },
      grep: /@portfolio/,
      grepInvert: /@siteagent|@wip/,
      dependencies: [], // Don't depend on setup by default
    },
    // Legacy chromium project (no tag filtering)
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
    // Use dev server for the app being tested
    // Portfolio: vite with portfolio config on 127.0.0.1:5174
    // Siteagent: vite default on 127.0.0.1:5173
    // Can override with PW_START env var for custom commands
    command: process.env.PW_START || (process.env.PW_APP === 'portfolio'
      ? 'npx vite --config vite.config.portfolio.ts --port 5174 --host 127.0.0.1 --strictPort'
      : 'npx vite --port 5173 --host 127.0.0.1 --strictPort'),
    url: process.env.PW_BASE_URL || (process.env.PW_APP === 'portfolio' ? 'http://127.0.0.1:5174' : 'http://127.0.0.1:5173'),
    reuseExistingServer: true, // Always reuse to avoid port conflicts
    timeout: 120_000, // Give CI time to build and start
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
