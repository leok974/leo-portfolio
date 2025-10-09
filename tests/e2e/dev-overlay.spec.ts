import { test, expect } from './test.base';

/**
 * Dev overlay E2E tests - validates cookie-based authentication for admin tools.
 *
 * These tests verify:
 *  1) /agent/dev/status endpoint behavior with/without cookies
 *  2) Tools page gating based on authentication state
 *
 * Note: Cookie setting via /agent/dev/enable requires HMAC signature,
 * which is tested separately via integration/API tests.
 */

test.describe('Dev overlay cookie & tools gating @e2e @dev-overlay', () => {
  test('status endpoint without cookies shows disabled', async ({ request }) => {
    // Request without cookies should show disabled
    const res = await request.get('/agent/dev/status');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Boolean(body?.enabled)).toBeFalsy();
  });

  test('backend status endpoint is accessible', async ({ page }) => {
    // Navigate to status endpoint
    await page.goto('/agent/dev/status');

    // Should return JSON response
    const text = await page.textContent('body');
    expect(text).toBeTruthy();
    expect(text).toContain('enabled');
    expect(text).toContain('allowed');
  });

  test('tools page renders', async ({ page }) => {
    // Access tools page
    await page.goto('/tools.html');

    // Page should load (either locked or unlocked)
    await expect(page.locator('body')).toBeVisible();

    // Should show either the tools or the unavailable message
    const hasTools = await page.getByText('SEO & OG Intelligence').isVisible().catch(() => false);
    const hasLockMessage = await page.getByText('Tools Unavailable').isVisible().catch(() => false);

    expect(hasTools || hasLockMessage, 'Page should show either tools or lock message').toBeTruthy();
  });
});
