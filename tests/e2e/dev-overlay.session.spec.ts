/**
 * @file Dev overlay session/cookie persistence tests
 *
 * These tests verify that:
 * 1. The sa_dev cookie persists across page navigations
 * 2. The saved storageState can be reused in new browser contexts
 *
 * The setup project (dev-overlay.setup.ts) handles authentication
 * and creates the initial storage state file.
 */

import { test, expect } from './test.base';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE = path.resolve(__dirname, '../../playwright/.auth/dev-overlay.json');

test.describe('Dev overlay cookie & persistence @e2e @dev-overlay', () => {
  test('verify overlay cookie and status across requests', async ({ page }) => {
    // Cookie should already be set from the chromium-dev-overlay project's storageState

    // 1) Verify cookie exists
    const cookies = await page.context().cookies();
    const overlayCookie = cookies.find(c => /^sa_dev/i.test(c.name));
    expect(overlayCookie, 'Overlay cookie (sa_dev*) should be present from storageState').toBeTruthy();

    // 2) Status WITH cookies → enabled
    const resStatus = await page.goto('/agent/dev/status', { waitUntil: 'domcontentloaded' });
    expect(resStatus?.ok()).toBeTruthy();
    const body = await page.textContent('body');
    expect(body || '').toMatch(/"enabled"\s*:\s*true/);

    // 3) Tools unlocked
    await page.goto('/tools.html');
    await expect(page.getByText('Agent Tools')).toBeVisible();
    const unavailableMsg = page.getByText('Enable the admin overlay to access tools.');
    await expect(unavailableMsg).toHaveCount(0);
  });

  test('storage state persists across new contexts', async ({ browser }) => {
    // Create new context with saved storage state
    const ctx = await browser.newContext({ storageState: STORAGE });
    const page = await ctx.newPage();

    // Verify status endpoint works with loaded cookies
    await page.goto('/agent/dev/status');
    const body = await page.textContent('body');
    expect(body || '').toMatch(/"enabled"\s*:\s*true/);

    // Verify tools remain unlocked
    await page.goto('/tools.html');
    await expect(page.getByText('Agent Tools')).toBeVisible();

    await ctx.close();
  });
});
