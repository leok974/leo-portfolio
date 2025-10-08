/**
 * Setup script to enable dev overlay and save auth state
 * This runs as a setup project before other tests
 */

import { test as setup, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_FILE = path.resolve(__dirname, '../../playwright/.auth/dev-overlay.json');

setup('enable dev overlay and save auth', async ({ browser, baseURL }) => {
  // Calculate HMAC signature for /agent/dev/enable
  const secret = process.env.SITEAGENT_HMAC_SECRET || 'local-dev-secret-12345';
  const bodyStr = JSON.stringify({ hours: 24 });
  const signature = createHmac('sha256', secret).update(bodyStr).digest('hex');

  // Create a new context and make API call to enable overlay
  const context = await browser.newContext({baseURL});

  // Use the frontend's proxy to the API so cookie is set on the same domain
  // Frontend proxies /agent/* to the backend
  const response = await context.request.post('/agent/dev/enable', {
    headers: {
      'Content-Type': 'application/json',
      'X-SiteAgent-Signature': `sha256=${signature}`
    },
    data: bodyStr
  });

  expect(response.ok(), `Dev overlay enable should succeed (status: ${response.status()}, body: ${await response.text()})`).toBeTruthy();

  // Create a page in the same context to verify the cookie
  const page = await context.newPage();

  // Verify the cookie was set by checking status (through proxy)
  await page.goto('/agent/dev/status');
  const statusText = await page.textContent('body');
  expect(statusText).toMatch(/"enabled"\s*:\s*true/);

  // Save authenticated state for other tests
  await context.storageState({ path: STORAGE_FILE });
  console.log('[setup] Dev overlay enabled and auth state saved to', STORAGE_FILE);

  await context.close();
});
