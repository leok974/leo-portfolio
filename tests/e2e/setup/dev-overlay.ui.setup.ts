/**
 * Global setup for dev overlay E2E tests
 *
 * Fetches the dev overlay cookie from the backend and saves it to a storage state file.
 * This allows all tests to run with the HttpOnly cookie pre-injected, enabling
 * authenticated access to dev overlay features.
 *
 * Environment Variables:
 * - BACKEND_URL: Backend API URL (default: http://127.0.0.1:8001)
 * - UI_URL: Frontend UI URL (default: http://127.0.0.1:5173)
 * - PW_STATE: Path to storage state file (default: tests/e2e/.auth/dev-overlay-state.json)
 * - DEV_OVERLAY_COOKIE_NAME: Cookie name (default: sa_dev)
 * - DEV_BEARER: Bearer token for API auth (default: dev)
 */
import fs from 'node:fs/promises';
import { request as PWRequest, chromium, type FullConfig } from '@playwright/test';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8001';
const UI = process.env.UI_URL || 'http://127.0.0.1:5173';
const STATE_PATH = process.env.PW_STATE || 'tests/e2e/.auth/dev-overlay-state.json';
const COOKIE_NAME = process.env.DEV_OVERLAY_COOKIE_NAME || 'sa_dev';
const BEARER = process.env.DEV_BEARER || 'dev';

function parseSetCookie(value: string, name: string): string | null {
  // Simple parse for "name=value; Attr=...; ..."
  const parts = value.split(';')[0].trim();
  const idx = parts.indexOf('=');
  if (idx < 0) return null;
  const k = parts.slice(0, idx).trim();
  const v = parts.slice(idx + 1).trim();
  if (k === name) return v;
  return null;
}

export default async function globalSetup(_: FullConfig) {
  console.log('🔧 Setting up dev overlay authentication...');

  // Skip backend-dependent setup if BACKEND_REQUIRED=0
  if (process.env.BACKEND_REQUIRED === '0' || process.env.BACKEND_REQUIRED === 'false') {
    console.log('⏭️  Skipping dev overlay setup (BACKEND_REQUIRED=0), creating dummy auth state...');
    // Create empty auth state so tests don't fail looking for file
    await fs.mkdir(STATE_PATH.split('/').slice(0, -1).join('/'), { recursive: true });
    await fs.writeFile(STATE_PATH, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  // 1) Ask backend to enable overlay (sets HttpOnly cookie in response)
  const api = await PWRequest.newContext({
    baseURL: BACKEND,
    extraHTTPHeaders: { Authorization: `Bearer ${BEARER}` },
  });

  try {
    const res = await api.post('/agent/dev/enable');
    if (!res.ok()) {
      console.warn(`⚠️ /agent/dev/enable failed: ${res.status()} ${await res.text()}`);
      await api.dispose();
      return;
    }

    const setCookies = res.headers()['set-cookie'];
    await api.dispose();

    if (!setCookies) {
      console.warn('⚠️ No Set-Cookie header returned; cannot inject overlay cookie.');
      return;
    }

    // 2) Extract the signed cookie value
    // Note: some stacks can return multiple Set-Cookie headers concatenated by comma.
    const cookieHeader = Array.isArray(setCookies) ? setCookies.join(',') : setCookies;
    const maybeMany = cookieHeader.split(/,(?=[^ ;]+=)/); // split only between cookie pairs
    let cookieValue: string | null = null;
    for (const c of maybeMany) {
      const v = parseSetCookie(c, COOKIE_NAME);
      if (v) {
        cookieValue = v;
        break;
      }
    }

    if (!cookieValue) {
      console.warn(`⚠️ Could not find ${COOKIE_NAME} in Set-Cookie.`);
      return;
    }

    // 3) Build a storageState with the cookie for BOTH UI and backend origins
    // (handy for API+UI tests)
    const uiURL = new URL(UI);
    const beURL = new URL(BACKEND);

    const cookies = [
      {
        name: COOKIE_NAME,
        value: cookieValue,
        domain: uiURL.hostname,
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: uiURL.protocol === 'https:',
        sameSite: 'Lax' as const,
      },
      {
        name: COOKIE_NAME,
        value: cookieValue,
        domain: beURL.hostname,
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: beURL.protocol === 'https:',
        sameSite: 'Lax' as const,
      },
    ];

    // 4) Validate by loading a context and saving storageState
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ storageState: { cookies, origins: [] } });

    // 5) Ensure directory exists for the state file
    const dirPath = STATE_PATH.substring(0, STATE_PATH.lastIndexOf('/'));
    await fs.mkdir(dirPath, { recursive: true });

    await ctx.storageState({ path: STATE_PATH });
    await browser.close();

    console.log(`✅ Dev overlay cookie installed for ${uiURL.origin} and ${beURL.origin}`);
    console.log(`📝 Storage state saved to ${STATE_PATH}`);
  } catch (error) {
    console.error('❌ Failed to setup dev overlay authentication:', error);
    await api.dispose();
    throw error;
  }
}
