import { test } from '@playwright/test';

test('debug privacy page init', async ({ page }) => {
  // Capture console logs
  page.on('console', msg => console.log(`[BROWSER ${msg.type()}]`, msg.text()));
  page.on('pageerror', err => console.error('[BROWSER ERROR]', err));

  await page.goto('http://localhost:8080/privacy.html');
  
  // Wait a bit to see logs
  await page.waitForTimeout(2000);
  
  // Check what's in window
  const debug = await page.evaluate(() => ({
    consent: typeof (window as any).consent,
    __privacyPageReady: (window as any).__privacyPageReady,
    __privacyPageReadyReason: (window as any).__privacyPageReadyReason,
  }));
  
  console.log('[DEBUG] Window state:', debug);
});
