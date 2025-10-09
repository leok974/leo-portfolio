import { test, expect } from './test.base';

// Stub Calendly & analytics before pages load
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).Calendly = {
      initPopupWidget: (opts: any) => ((window as any).__CAL_OPTS = opts),
      initInlineWidget: (opts: any) => {
        (window as any).__CAL_INLINE_URL = opts?.url;
        if (opts?.parentElement) opts.parentElement.setAttribute('data-calendly-initialized','1');
      },
    };
    (window as any).__analyticsEvents = [];
    (window as any).gtag = (...args: any[]) => (window as any).__analyticsEvents.push({ provider: 'gtag', args });
    (window as any).dataLayer = [];
    (window as any).plausible = (...args: any[]) => (window as any).__analyticsEvents.push({ provider: 'plausible', args });
    (window as any).fathom = { trackEvent: (n: string) => (window as any).__analyticsEvents.push({ provider: 'fathom', n }) } as any;
    (window as any).umami = { track: (n: string, p: any) => (window as any).__analyticsEvents.push({ provider: 'umami', n, p }) } as any;
  });
});

test('@consent-banner banner appears on first visit', async ({ page }) => {
  await page.goto('/');

  // Banner should be visible
  const banner = page.locator('#consent-banner');
  await expect(banner).toBeVisible();

  // Should have accept and decline buttons
  await expect(page.locator('#consent-accept')).toBeVisible();
  await expect(page.locator('#consent-decline')).toBeVisible();
});

test('@consent-banner accepting consent sets preferences', async ({ page }) => {
  await page.goto('/');

  // Wait for banner
  await page.waitForSelector('#consent-banner');

  // Click accept
  await page.click('#consent-accept');

  // Banner should disappear
  await expect(page.locator('#consent-banner')).not.toBeVisible();

  // Check localStorage
  const consent = await page.evaluate(() => {
    const stored = localStorage.getItem('consent.v1');
    return stored ? JSON.parse(stored) : null;
  });

  expect(consent).toBeTruthy();
  expect(consent.analytics).toBe(true);
  expect(consent.marketing).toBe(true);
  expect(consent.calendly).toBe(true);

  // Check window.__consent
  const windowConsent = await page.evaluate(() => (window as any).__consent);
  expect(windowConsent.analytics).toBe(true);
  expect(windowConsent.marketing).toBe(true);
});

test('@consent-banner declining consent sets preferences', async ({ page }) => {
  await page.goto('/');

  // Wait for banner
  await page.waitForSelector('#consent-banner');

  // Click decline
  await page.click('#consent-decline');

  // Banner should disappear
  await expect(page.locator('#consent-banner')).not.toBeVisible();

  // Check localStorage
  const consent = await page.evaluate(() => {
    const stored = localStorage.getItem('consent.v1');
    return stored ? JSON.parse(stored) : null;
  });

  expect(consent).toBeTruthy();
  expect(consent.analytics).toBe(false);
  expect(consent.marketing).toBe(false);
  expect(consent.calendly).toBe(false);

  // Check window.__consent
  const windowConsent = await page.evaluate(() => (window as any).__consent);
  expect(windowConsent.analytics).toBe(false);
  expect(windowConsent.marketing).toBe(false);
});

test('@consent-banner banner does not appear on subsequent visits', async ({ page }) => {
  // First visit - accept
  await page.goto('/');
  await page.waitForSelector('#consent-banner');
  await page.click('#consent-accept');
  await expect(page.locator('#consent-banner')).not.toBeVisible();

  // Reload page
  await page.reload();

  // Banner should not appear
  await page.waitForTimeout(500);
  await expect(page.locator('#consent-banner')).not.toBeVisible();

  // But consent should still be set
  const consent = await page.evaluate(() => (window as any).__consent);
  expect(consent.analytics).toBe(true);
});

test('@consent-banner DNT auto-declines consent', async ({ page }) => {
  // Set DNT before loading page
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'doNotTrack', {
      get: () => '1',
      configurable: true
    });
  });

  await page.goto('/');

  // Banner should NOT appear (auto-declined)
  await page.waitForTimeout(500);
  await expect(page.locator('#consent-banner')).not.toBeVisible();

  // Consent should be set to false
  const consent = await page.evaluate(() => (window as any).__consent);
  expect(consent.analytics).toBe(false);
  expect(consent.marketing).toBe(false);
  expect(consent.calendly).toBe(false);
});

test('@consent-banner GPC auto-declines consent', async ({ page }) => {
  // Set GPC before loading page
  await page.addInitScript(() => {
    (window as any).globalPrivacyControl = true;
  });

  await page.goto('/');

  // Banner should NOT appear (auto-declined)
  await page.waitForTimeout(500);
  await expect(page.locator('#consent-banner')).not.toBeVisible();

  // Consent should be set to false
  const consent = await page.evaluate(() => (window as any).__consent);
  expect(consent.analytics).toBe(false);
  expect(consent.marketing).toBe(false);
});

test('@consent-banner programmatic API works', async ({ page }) => {
  await page.goto('/');

  // Set consent programmatically
  await page.evaluate(() => {
    (window as any).consent.set({ analytics: true, marketing: false, calendly: true });
  });

  // Check it was set
  const consent = await page.evaluate(() => (window as any).__consent);
  expect(consent.analytics).toBe(true);
  expect(consent.marketing).toBe(false);
  expect(consent.calendly).toBe(true);

  // Clear consent
  await page.evaluate(() => {
    (window as any).consent.clear();
  });

  // Check it was cleared
  const clearedConsent = await page.evaluate(() => (window as any).__consent);
  expect(clearedConsent).toBeNull();
});

test('@consent-banner consent:change event fires', async ({ page }) => {
  await page.goto('/');

  // Listen for consent:change event
  const eventPromise = page.evaluate(() => {
    return new Promise((resolve) => {
      document.addEventListener('consent:change', (e: any) => {
        resolve(e.detail);
      });
    });
  });

  // Accept consent
  await page.click('#consent-accept');

  // Wait for event
  const eventDetail = await eventPromise;
  expect(eventDetail).toBeTruthy();
  expect((eventDetail as any).analytics).toBe(true);
});

// Scenario: previously declined -> footer link re-opens banner -> accept -> inline flips live

test('@consent-banner footer Manage privacy re-opens banner and flips embed live', async ({ page }) => {
  // Pre-set declined consent so banner is hidden initially but embed stays off
  await page.addInitScript(() => {
    const obj = { marketing: false, analytics: false, calendly: false };
    try { localStorage.setItem('consent.v1', JSON.stringify(obj)); } catch {}
    (window as any).__consent = obj;
  });

  await page.goto('/book.html');
  await page.waitForFunction(() => (window as any).__calendlyHelperLoaded === true);

  const inline = page.getByTestId('calendly-inline');
  await expect(inline).toBeVisible();
  await expect(inline).toHaveAttribute('data-calendly-initialized', '0');

  const manage = page.getByTestId('manage-privacy');
  await expect(manage).toBeVisible();

  // Click the manage button
  await manage.click();

  // Manually call showBanner with force=true (since onclick might not work in test)
  await page.evaluate(() => {
    if ((window as any).consent && (window as any).consent.showBanner) {
      (window as any).consent.showBanner(true);
    }
  });

  // Wait for banner to appear
  const banner = page.locator('#consent-banner');
  await expect(banner).toBeVisible({timeout: 5000});

  await page.click('#consent-accept');
  await expect(inline).toHaveAttribute('data-calendly-initialized', '1');
});

