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
 */
async function ensureBackendRunning(): Promise<void> {
  console.log('[globalSetup] Checking backend at', API_URL);
  
  if (await pingBackend(API_URL)) {
    console.log('[globalSetup] Backend already running');
    return;
  }

  console.log('[globalSetup] Starting backend server...');
  
  // Determine Python command based on platform
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  
  backendProcess = spawn(
    pythonCmd,
    ['-m', 'uvicorn', 'assistant_api.main:app', '--host', '127.0.0.1', '--port', '8001'],
    { 
      stdio: 'inherit',
      shell: true,
      detached: false
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

export default async function globalSetup() {
  process.env.PLAYWRIGHT_GLOBAL_SETUP = '1';

  // Skip if explicitly requested (frontend-only mode)
  if (process.env.PLAYWRIGHT_GLOBAL_SETUP_SKIP === '1') {
    console.warn('[globalSetup] Skipped via PLAYWRIGHT_GLOBAL_SETUP_SKIP=1');
    return;
  }

  // Ensure backend is running
  await ensureBackendRunning();

  // Return cleanup function
  return async () => {
    if (backendProcess && !backendProcess.killed) {
      console.log('[globalTeardown] Stopping backend server...');
      backendProcess.kill();
    }
  };
}
