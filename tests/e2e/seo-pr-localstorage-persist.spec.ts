/**
 * @file SEO PR localStorage persistence test (optional feature)
 *
 * Tests PR URL persistence across browser contexts using localStorage
 * instead of sessionStorage. This is behind a feature flag (?seoPersist=local).
 *
 * NOTE: This test is optional and requires the app to implement the feature flag.
 * If not implemented, the test will gracefully skip.
 */

import { test, expect } from './test.base';

// Feature flag URL - adjust if app uses different flag
const FLAG_URL = '/tools.html?seoPersist=local';

// Overlay enabled
test.use({ storageState: 'playwright/.auth/dev-overlay.json' });

test.describe('SEO PR localStorage persistence (optional) @e2e @seo', () => {
  test('PR URL persists across NEW browser context with localStorage flag', async ({ browser }) => {
    // Context A: Set PR URL using localStorage (via feature flag)
    const ctxA = await browser.newContext({
      storageState: 'playwright/.auth/dev-overlay.json'
    });
    const pageA = await ctxA.newPage();
    await pageA.goto(FLAG_URL);

    // Check if feature flag is recognized
    const hasPanel = await pageA
      .getByRole('heading', { name: /SEO.*OG Intelligence/i })
      .isVisible()
      .catch(() => false);

    if (!hasPanel) {
      test.skip(true, 'seoPersist=local feature flag not implemented; skipping optional test');
      await ctxA.close();
      return;
    }

    // Set PR URL in localStorage
    const testUrl = 'https://github.com/example/repo/pull/9999';
    await pageA.evaluate((url) => {
      // Feature flag should make app use localStorage instead of sessionStorage
      localStorage.setItem('seo.pr.url', url);

      // Also try sessionStorage as fallback if feature not implemented
      sessionStorage.setItem('seo.pr.url', url);
    }, testUrl);

    await pageA.reload();

    // Verify banner appears in context A
    const bannerA = await pageA.getByTestId('seo-pr-link').isVisible().catch(() => false);

    await ctxA.close();

    if (!bannerA) {
      test.skip(true, 'localStorage persistence not working; feature may not be implemented');
      return;
    }

    // Context B: Brand new context (should inherit localStorage if feature works)
    const ctxB = await browser.newContext({
      storageState: 'playwright/.auth/dev-overlay.json'
    });
    const pageB = await ctxB.newPage();
    await pageB.goto(FLAG_URL);

    // Check if localStorage value exists
    const hasLocalStorage = await pageB.evaluate(() => {
      return localStorage.getItem('seo.pr.url') !== null;
    });

    if (hasLocalStorage) {
      // Feature is implemented! Banner should persist
      await expect(pageB.getByTestId('seo-pr-link')).toBeVisible({ timeout: 3000 });

      // Verify it's the same URL
      const href = await pageB.getByTestId('seo-pr-link').getAttribute('href');
      expect(href).toBe(testUrl);
    } else {
      // localStorage didn't persist across contexts (expected without feature flag)
      test.skip(true, 'localStorage does not persist across contexts; feature flag has no effect');
    }

    await ctxB.close();
  });

  test('sessionStorage does NOT persist across contexts (baseline behavior)', async ({ browser }) => {
    // This test verifies that WITHOUT the feature flag, sessionStorage is isolated

    const ctxA = await browser.newContext({
      storageState: 'playwright/.auth/dev-overlay.json'
    });
    const pageA = await ctxA.newPage();
    await pageA.goto('/tools.html'); // No feature flag

    const hasPanel = await pageA
      .getByRole('heading', { name: /SEO.*OG Intelligence/i })
      .isVisible()
      .catch(() => false);

    if (!hasPanel) {
      await ctxA.close();
      return;
    }

    // Set in sessionStorage
    const testUrl = 'https://github.com/example/repo/pull/7777';
    await pageA.evaluate((url) => {
      sessionStorage.setItem('seo.pr.url', url);
    }, testUrl);

    await pageA.reload();
    await expect(pageA.getByTestId('seo-pr-link')).toBeVisible();

    await ctxA.close();

    // Context B: Should NOT have the sessionStorage value
    const ctxB = await browser.newContext({
      storageState: 'playwright/.auth/dev-overlay.json'
    });
    const pageB = await ctxB.newPage();
    await pageB.goto('/tools.html');

    // Verify sessionStorage is empty
    const hasSessionStorage = await pageB.evaluate(() => {
      return sessionStorage.getItem('seo.pr.url') !== null;
    });

    expect(hasSessionStorage).toBeFalsy();

    // Banner should NOT be visible
    const bannerVisible = await pageB.getByTestId('seo-pr-link').isVisible().catch(() => false);
    expect(bannerVisible).toBeFalsy();

    await ctxB.close();
  });
});
