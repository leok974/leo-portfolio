import { request as playwrightRequest } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { API_URL } from './lib/api';

let backendProcess: ChildProcess | null = null;

/**
 * Check if backend API is reachable
 */
async function pingBackend(url: string): Promise<boolean> {
  const ctx = await playwrightRequest.newContext();
  try {
    const response = await ctx.get(`${url}/agent/dev/status`);
    return response.ok();
  } catch {
    return false;
  } finally {
    await ctx.dispose();
  }
}

/**
 * Start backend server if not already running
 * NO --reload to prevent restarts when tests write assets/layout.json or data/*.jsonl
 */
async function ensureBackendRunning(): Promise<void> {
  console.log('[globalSetup] Checking backend at', API_URL);

  if (await pingBackend(API_URL)) {
    console.log('[globalSetup] Backend already running');
    return;
  }

  console.log('[globalSetup] Starting backend server (no reload for test stability)...');

  // Determine Python command based on platform
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

  // Start uvicorn WITHOUT --reload to prevent restarts when tests write files
  // Also disable scheduler to keep tests deterministic
  backendProcess = spawn(
    pythonCmd,
    ['-m', 'uvicorn', 'assistant_api.main:app', '--host', '127.0.0.1', '--port', '8001'],
    {
      stdio: 'inherit',
      shell: true,
      detached: false,
      env: {
        ...process.env,
        SCHEDULER_ENABLED: '0',  // Disable scheduler during tests
      }
    }
  );

  // Wait for backend to be ready (max 30 seconds)
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (await pingBackend(API_URL)) {
      console.log('[globalSetup] Backend ready after', i + 1, 'seconds');
      return;
    }
  }

  throw new Error('[globalSetup] Backend failed to start within 30 seconds');
}

/**
 * Seed test data once after backend is ready
 * This avoids race conditions and ensures consistent test state
 */
async function seedTestData(): Promise<void> {
  console.log('[globalSetup] Seeding test data...');
  const ctx = await playwrightRequest.newContext();
  
  try {
    // Enable dev overlay for admin tests
    await ctx.post(`${API_URL}/agent/dev/enable`);
    console.log('[globalSetup] Dev overlay enabled');

    // Seed initial layout optimization
    const layoutResponse = await ctx.post(`${API_URL}/agent/act`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        task: 'layout.optimize',
        payload: { preset: 'recruiter' }
      }
    });

    if (layoutResponse.ok()) {
      console.log('[globalSetup] Layout seeded successfully');
    } else {
      console.warn('[globalSetup] Layout seed failed:', layoutResponse.status());
    }
  } catch (error) {
    console.warn('[globalSetup] Seed error:', error);
  } finally {
    await ctx.dispose();
  }
}

export default async function globalSetup() {
  process.env.PLAYWRIGHT_GLOBAL_SETUP = '1';

  // Skip if explicitly requested (frontend-only mode)
  if (process.env.PLAYWRIGHT_GLOBAL_SETUP_SKIP === '1') {
    console.warn('[globalSetup] Skipped via PLAYWRIGHT_GLOBAL_SETUP_SKIP=1');
    return;
  }

  // Ensure backend is running
  await ensureBackendRunning();

  // Seed test data once (dev overlay + initial layout)
  await seedTestData();

  // Return cleanup function
  return async () => {
    if (backendProcess && !backendProcess.killed) {
      console.log('[globalTeardown] Stopping backend server...');
      backendProcess.kill();
    }
  };
}
