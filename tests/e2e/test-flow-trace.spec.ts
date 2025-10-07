import { test, expect } from '@playwright/test';

// Stub Calendly offline
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).Calendly = {
      initInlineWidget: (opts: any) => {
        console.log('[STUB] initInlineWidget called');
        if (opts?.parentElement) opts.parentElement.setAttribute('data-calendly-initialized','1');
      },
    };
  });
});

test('trace privacy -> book flow', async ({ page }) => {
  // Capture all logs
  page.on('console', msg => console.log(`[BROWSER ${msg.type()}]`, msg.text()));

  // Start clean
  await page.addInitScript(() => {
    try { localStorage.removeItem('consent.v1'); } catch {}
  });

  // Go to privacy page
  await page.goto('/privacy.html');
  await page.waitForFunction(() => (window as any).__privacyPageReady === true);

  console.log('=== Setting calendly to TRUE ===');

  // Set calendly ON
  await page.locator('#chk-calendly').setChecked(true);
  await page.getByTestId('privacy-save').click();

  // Check localStorage after save
  const consentAfterSave = await page.evaluate(() => {
    return localStorage.getItem('consent.v1');
  });
  console.log('[CONSENT SAVED]:', consentAfterSave);

  await expect(page.locator('#status')).toHaveText('✓ Preferences saved');

  console.log('=== Navigating to book.html ===');

  // Navigate to book page
  await page.goto('/book.html');

  // Check localStorage on book page
  const consentOnBook = await page.evaluate(() => {
    return {
      localStorage: localStorage.getItem('consent.v1'),
      windowConsent: (window as any).consent?.get?.(),
      __consent: (window as any).__consent,
    };
  });
  console.log('[CONSENT ON BOOK]:', JSON.stringify(consentOnBook, null, 2));

  await page.waitForFunction(() => (window as any).__calendlyHelperLoaded === true);

  const inline = page.getByTestId('calendly-inline');
  const initValue = await inline.getAttribute('data-calendly-initialized');
  console.log('[WIDGET INITIALIZED]:', initValue);

  await expect(inline).toHaveAttribute('data-calendly-initialized', '1');
});
