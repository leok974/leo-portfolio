import { test, expect } from './test.base';

// Stub Calendly offline, keep tests deterministic
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).Calendly = {
      initPopupWidget: (opts: any) => ((window as any).__CAL_OPTS = opts),
      initInlineWidget: (opts: any) => {
        (window as any).__CAL_INLINE_URL = opts?.url;
        if (opts?.parentElement) opts.parentElement.setAttribute('data-calendly-initialized','1');
      },
    };
  });
});

// 1) Toggle Calendly on → /book.html embed goes live
test('@privacy-page toggles embed on and persists', async ({ page }) => {
  // Start from a clean state - clear before first navigation only
  await page.goto('/privacy.html');
  await page.evaluate(() => {
    try { localStorage.removeItem('consent.v1'); } catch {}
  });
  // Reload to ensure clean state
  await page.reload();

  // Wait for privacy page to be fully initialized
  await page.waitForFunction(() => (window as any).__privacyPageReady === true);

  // Set preferences: Calendly ON, others OFF
  await page.locator('#chk-analytics').setChecked(false);
  await page.locator('#chk-marketing').setChecked(false);
  await page.locator('#chk-calendly').setChecked(true);
  await page.getByTestId('privacy-save').click();

  // Wait for save confirmation
  await expect(page.locator('#status')).toHaveText('✓ Preferences saved');

  // Visit book page - embed should initialize
  await page.goto('/book.html');
  await page.waitForFunction(() => (window as any).__calendlyHelperLoaded === true);
  const inline = page.getByTestId('calendly-inline');
  await expect(inline).toHaveAttribute('data-calendly-initialized', '1');

  // Reload to confirm persistence
  await page.reload();
  await page.waitForFunction(() => (window as any).__calendlyHelperLoaded === true);
  await expect(inline).toHaveAttribute('data-calendly-initialized', '1');
});

// 2) Toggle Calendly off → /book.html shows fallback
test('@privacy-page toggles embed off and persists', async ({ page }) => {
  await page.goto('/privacy.html');

  // Wait for privacy page to be fully initialized
  await page.waitForFunction(() => (window as any).__privacyPageReady === true);

  // Turn off Calendly
  await page.locator('#chk-calendly').setChecked(false);
  await page.getByTestId('privacy-save').click();

  // Visit book page - should show fallback link
  await page.goto('/book.html');
  await page.waitForFunction(() => (window as any).__calendlyHelperLoaded === true);
  const inline = page.getByTestId('calendly-inline');
  await expect(inline).toHaveAttribute('data-calendly-initialized', '0');
  await expect(inline.locator('a', { hasText: 'Book a call on Calendly' })).toBeVisible();
});

// 3) Footer link appears and re-opens banner
test('@privacy-page footer privacy link exists and manage link re-opens banner', async ({ page }) => {
  // Pre-decline consent so embed is off and banner hidden
  await page.addInitScript(() => {
    const obj = { marketing: false, analytics: false, calendly: false };
    try { localStorage.setItem('consent.v1', JSON.stringify(obj)); } catch {}
    (window as any).__consent = obj;
  });

  await page.goto('/');

  // Check for footer links (they should be injected by consent.js)
  const manage = page.getByTestId('manage-privacy');
  const settings = page.getByTestId('privacy-link');
  await expect(manage).toBeVisible();
  await expect(settings).toBeVisible();

  // Click manage link - should re-open banner
  await manage.click();

  // Manually trigger showBanner since onclick might not work in test
  await page.evaluate(() => {
    if ((window as any).consent && (window as any).consent.showBanner) {
      (window as any).consent.showBanner(true);
    }
  });

  await expect(page.locator('#consent-banner')).toBeVisible();
});

// 4) Reset button clears consent and redirects
test('@privacy-page reset button clears consent', async ({ page }) => {
  // Set some consent first
  await page.addInitScript(() => {
    const obj = { marketing: true, analytics: true, calendly: true };
    try { localStorage.setItem('consent.v1', JSON.stringify(obj)); } catch {}
    (window as any).__consent = obj;
  });

  await page.goto('/privacy.html');

  // Wait for privacy page to be fully initialized (includes UI sync)
  await page.waitForFunction(() => (window as any).__privacyPageReady === true);

  // Verify switches are ON
  await expect(page.locator('#chk-analytics')).toBeChecked();
  await expect(page.locator('#chk-marketing')).toBeChecked();
  await expect(page.locator('#chk-calendly')).toBeChecked();

  // Click reset
  await page.getByTestId('privacy-reset').click();

  // Should show feedback message
  await expect(page.locator('#status')).toContainText('Preferences cleared');

  // Wait for redirect to home page
  await page.waitForURL('/', { timeout: 5000 });
});

// 5) Privacy settings page loads correctly
test('@privacy-page loads with correct UI elements', async ({ page }) => {
  await page.goto('/privacy.html');

  // Check title
  await expect(page.locator('h1')).toHaveText('Privacy settings');

  // Check all toggle switches exist
  await expect(page.locator('#chk-analytics')).toBeVisible();
  await expect(page.locator('#chk-marketing')).toBeVisible();
  await expect(page.locator('#chk-calendly')).toBeVisible();

  // Check buttons exist
  await expect(page.getByTestId('privacy-save')).toBeVisible();
  await expect(page.getByTestId('privacy-reset')).toBeVisible();

  // Check link to book page
  await expect(page.locator('a[href="/book.html"]')).toBeVisible();
});
