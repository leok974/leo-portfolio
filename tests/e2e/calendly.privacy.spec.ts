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

// Helper: flip consent object and/or DNT/GPC
async function setConsent(page: any, consent: any) {
  await page.addInitScript((c: any) => { (window as any).__consent = c; }, consent);
}

async function setDNT(page: any, value: '0' | '1') {
  await page.addInitScript((v: any) => { Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => v }); }, value);
}

async function setGPC(page: any, on: boolean) {
  await page.addInitScript((g: any) => { (window as any).globalPrivacyControl = g; }, on);
}

// 1) Consent denied → no analytics, inline renders fallback link
test('@privacy consent denied blocks analytics and embed', async ({ page }) => {
  await setConsent(page, { marketing: false });
  await page.goto('/book.html');
  await page.waitForFunction(() => (window as any).__calendlyHelperLoaded === true);

  // Wait for inline to process
  await page.waitForTimeout(500);

  const inline = page.getByTestId('calendly-inline');
  await expect(inline).toBeVisible();

  // Should not initialize inline embed
  await expect(inline).toHaveAttribute('data-calendly-initialized', '0');

  // Should contain fallback link
  const link = inline.locator('a[href*="calendly.com"]');
  await expect(link).toBeVisible();
  await expect(link).toHaveText(/Book a call/i);

  // Verify no analytics events were tracked
  const events = await page.evaluate(() => (window as any).__analyticsEvents || []);
  const calendarEvents = events.filter((e: any) => e.event?.includes('calendly'));
  expect(calendarEvents.length).toBe(0);
});

// 2) DNT/GPC on → no analytics
for (const mode of ['dnt','gpc'] as const) {
  test(`@privacy privacy signal (${mode}) blocks analytics`, async ({ page }) => {
    if (mode === 'dnt') await setDNT(page, '1');
    if (mode === 'gpc') await setGPC(page, true);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__calendlyHelperLoaded === true);

    const btn = page.getByTestId('book-call');
    await btn.click();
    const events = await page.evaluate(() => (window as any).__analyticsEvents);
    expect(events.find((e: any) => e.event === 'calendly_open')).toBeFalsy();
  });
}

// 3) Consent allowed → analytics fires as normal
test('@privacy consent allowed permits analytics', async ({ page }) => {
  await setConsent(page, { marketing: true });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__calendlyHelperLoaded === true);

  const btn = page.getByTestId('book-call');
  await btn.click();
  const events = await page.evaluate(() => (window as any).__analyticsEvents);
  expect(events.find((e: any) => e.event === 'calendly_open')).toBeTruthy();
});
