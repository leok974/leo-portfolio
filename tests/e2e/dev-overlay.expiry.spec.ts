/**
 * @file Dev overlay cookie expiry regression test
 *
 * Ensures overlay fails closed (denies access) when cookie is invalidated.
 * This verifies the security property that expired/missing cookies
 * prevent privileged UI access.
 */

import { test, expect } from './test.base';

test.describe('Dev overlay expiry & security @e2e @dev-overlay', () => {
  test.use({ storageState: 'playwright/.auth/dev-overlay.json' });

  test('overlay cookie invalidation closes tools access', async ({ context, page }) => {
    // First verify we have initial access
    await page.goto('/tools.html');
    await expect(page.getByText('Agent Tools')).toBeVisible({ timeout: 3000 });

    // Invalidate the sa_dev cookie while preserving other cookies
    const cookies = (await context.cookies()).filter(c => !/^sa_dev/i.test(c.name));
    await context.clearCookies();

    // Re-add non-overlay cookies
    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    // Verify status endpoint reports disabled
    await page.goto('/agent/dev/status');
    const statusText = await page.textContent('body');
    expect(statusText || '').toMatch(/"enabled"\s*:\s*false/);

    // Verify tools page shows lockout message
    await page.goto('/tools.html');
    await expect(page.getByText('Tools Unavailable')).toBeVisible();
    await expect(page.getByText('Admin tools are restricted')).toBeVisible();

    // Ensure Agent Tools heading is NOT visible (access denied)
    await expect(page.getByText('Agent Tools')).toHaveCount(0);
  });

  test('expired cookie results in 401/403 on privileged endpoints', async ({ context, page }) => {
    // Clear sa_dev cookie
    const cookies = (await context.cookies()).filter(c => !/^sa_dev/i.test(c.name));
    await context.clearCookies();
    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    // Try to access privileged endpoint (layout optimization)
    const response = await page.request.post('/agent/act', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        task: 'layout.optimize',
        payload: { preset: 'recruiter' }
      },
      failOnStatusCode: false
    });

    // Should be unauthorized (401) or forbidden (403)
    expect(response.status()).toBeGreaterThanOrEqual(401);
    expect(response.status()).toBeLessThanOrEqual(403);
  });
});
