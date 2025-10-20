/**
 * E2E test to verify LedgerMind project card displays the new logo correctly.
 *
 * This test ensures:
 * 1. Logo image loads successfully (complete=true, naturalWidth>0)
 * 2. Correct absolute path is used (/assets/ledgermind-logo.png)
 * 3. No CSP violations or 404 errors
 */

import { test, expect } from '@playwright/test';

test('LedgerMind card shows the new logo', async ({ page }) => {
  // Navigate to portfolio with layout view
  await page.goto('/?layout=1');

  // Wait for app to be fully initialized
  await page.waitForFunction(() => (window as any).__APP_READY__ === true, { timeout: 10000 });

  // Find LedgerMind project card
  const card = page.getByTestId('project-card').filter({ hasText: 'LedgerMind' });
  await expect(card).toBeVisible();

  // Locate the image within the card
  const img = card.locator('img');
  await expect(img).toBeVisible();

  // Verify image loaded successfully
  const loaded = await img.evaluate((el) => {
    const imgEl = el as HTMLImageElement;
    return imgEl.complete && imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0;
  });
  expect(loaded, 'Logo image should load completely with valid dimensions').toBe(true);

  // Verify correct absolute path is used
  const src = await img.getAttribute('src');
  expect(src, 'Logo should use absolute path starting with /assets/').toContain('/assets/ledgermind-logo.png');

  // Verify no fallback class was applied (image loaded successfully)
  const hasFallback = await img.evaluate((el) => el.classList.contains('img-fallback'));
  expect(hasFallback, 'Logo should not have fallback class').toBe(false);
});

test('LedgerMind logo is accessible and not blocked by CSP', async ({ page }) => {
  // Track console errors (CSP violations would appear here)
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  // Navigate and wait for app
  await page.goto('/?layout=1');
  await page.waitForFunction(() => (window as any).__APP_READY__ === true);

  // Find LedgerMind card image
  const card = page.getByTestId('project-card').filter({ hasText: 'LedgerMind' });
  const img = card.locator('img');

  // Wait for image to load
  await img.waitFor({ state: 'visible' });

  // Check for CSP violations
  const cspErrors = errors.filter(err =>
    err.toLowerCase().includes('csp') ||
    err.toLowerCase().includes('content security policy') ||
    err.toLowerCase().includes('blocked')
  );

  expect(cspErrors, 'No CSP violations should occur when loading logo').toHaveLength(0);

  // Verify image HTTP status via network
  const response = await page.request.get('/assets/ledgermind-logo.png');
  expect(response.status(), 'Logo should return HTTP 200').toBe(200);
  expect(response.headers()['content-type'], 'Logo should have PNG content type').toContain('image/png');
});

test('LedgerMind logo has proper cache headers', async ({ page }) => {
  // Make direct request to logo asset
  const response = await page.request.get('/assets/ledgermind-logo.png');

  expect(response.status()).toBe(200);

  const cacheControl = response.headers()['cache-control'];
  expect(cacheControl, 'Assets should have immutable cache headers').toContain('immutable');
  expect(cacheControl, 'Assets should cache for 1 year').toMatch(/max-age=31536000/);
});
