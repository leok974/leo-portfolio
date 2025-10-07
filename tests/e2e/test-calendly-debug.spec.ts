import { test } from '@playwright/test';

test('debug calendly consent check', async ({ page }) => {
  // Stub Calendly
  await page.addInitScript(() => {
    (window as any).Calendly = {
      initInlineWidget: (opts: any) => {
        console.log('[STUB] initInlineWidget called with:', opts);
        if (opts?.parentElement) opts.parentElement.setAttribute('data-calendly-initialized','1');
      },
    };
  });

  // Set calendly consent to true
  await page.addInitScript(() => {
    try {
      localStorage.setItem('consent.v1', JSON.stringify({
        calendly: true,
        analytics: false,
        marketing: false,
        timestamp: Date.now()
      }));
    } catch {}
  });

  // Capture console logs
  page.on('console', msg => console.log(`[BROWSER ${msg.type()}]`, msg.text()));

  await page.goto('http://localhost:8080/book.html');

  // Wait for helper to load
  await page.waitForFunction(() => (window as any).__calendlyHelperLoaded === true);

  // Check consent state
  const debug = await page.evaluate(() => ({
    consent: (window as any).consent?.get?.(),
    __consent: (window as any).__consent,
    calendlyInitialized: document.getElementById('calendly-inline')?.getAttribute('data-calendly-initialized'),
  }));

  console.log('[DEBUG] State:', JSON.stringify(debug, null, 2));

  // Wait a bit for any delayed initialization
  await page.waitForTimeout(1000);

  const debug2 = await page.evaluate(() => ({
    calendlyInitialized: document.getElementById('calendly-inline')?.getAttribute('data-calendly-initialized'),
  }));

  console.log('[DEBUG] State after 1s:', JSON.stringify(debug2, null, 2));
});
