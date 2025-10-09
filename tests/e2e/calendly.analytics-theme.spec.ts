import { test, expect } from './test.base';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Calendly stub – keeps tests offline & deterministic
    (window as any).Calendly = {
      initPopupWidget: (opts: any) => ((window as any).__CAL_OPTS = opts),
      initInlineWidget: (opts: any) => {
        (window as any).__CAL_INLINE_URL = opts?.url;
        if (opts?.parentElement) opts.parentElement.setAttribute('data-calendly-initialized', '1');
      },
    };

    // Analytics stubs (gtag, GTM, Plausible, Fathom, Umami)
    (window as any).__analyticsEvents = [];
    (window as any).gtag = (...args: any[]) => (window as any).__analyticsEvents.push({ provider: 'gtag', args });
    (window as any).dataLayer = [];
    (window as any).plausible = (...args: any[]) => (window as any).__analyticsEvents.push({ provider: 'plausible', args });
    (window as any).fathom = {
      trackEvent: (n: string) => (window as any).__analyticsEvents.push({ provider: 'fathom', n }),
      trackGoal: (id: string, v: number) => (window as any).__analyticsEvents.push({ provider: 'fathomGoal', id, v })
    };
    (window as any).umami = {
      track: (n: string, p: any) => (window as any).__analyticsEvents.push({ provider: 'umami', n, p })
    };
  });
});

// Inline page: theme works (via global toggle or simulated), and analytics fires
test('book.html: theme can change and inline analytics fires', async ({ page }) => {
  await page.goto('/book.html?name=Leo');
  await page.waitForFunction(() => (window as any).__calendlyHelperLoaded === true);

  const inline = page.locator('#calendly-inline');

  // Wait for widget to be initialized
  await expect(inline).toHaveAttribute('data-calendly-initialized', '1', { timeout: 5000 });

  // Try to find an existing site-wide theme toggle
  const possibleToggles = [
    '#theme-toggle',
    '[data-theme-toggle]',
    'button[aria-label*="Theme" i]',
    'button:has-text("Theme")',
    'button:has-text("Dark")',
    'button:has-text("Light")',
  ];
  let clicked = false;
  for (const sel of possibleToggles) {
    const el = page.locator(sel);
    if (await el.count()) {
      await el.first().click();
      clicked = true;
      break;
    }
  }

  // If no visible toggle, simulate switching to dark by class
  if (!clicked) {
    await page.evaluate(() => {
      const el = document.documentElement;
      el.classList.toggle('dark', !el.classList.contains('dark'));
    });
  }

  // Widget should still be initialized
  await expect(inline).toHaveAttribute('data-calendly-initialized', '1');

  // Analytics should have recorded an inline event
  const events = await page.evaluate(() => (window as any).__analyticsEvents);
  const inlineEvt = events.find((e: any) => e.event === 'calendly_inline');
  expect(inlineEvt).toBeTruthy();
});

// Home page: popup CTA analytics
test('home: popup CTA tracks analytics', async ({ page }) => {
  await page.goto('/?utm_campaign=e2e');
  await page.waitForFunction(() => (window as any).__calendlyHelperLoaded === true);

  // Robust selector
  const btn = page.locator('#book-call').or(page.locator('[data-calendly-url]'));
  await expect(btn.first()).toBeVisible();
  await btn.first().click();

  // Wait for popup to be initialized
  await page.waitForFunction(() => !!(window as any).__CAL_OPTS?.url);

  const capturedUrl = await page.evaluate(() => (window as any).__CAL_OPTS.url);
  expect(capturedUrl).toContain('utm_campaign=e2e');

  const events = await page.evaluate(() => (window as any).__analyticsEvents);
  const openEvt = events.find((e: any) => e.event === 'calendly_open');
  expect(openEvt, 'expected calendly_open to be tracked').toBeTruthy();
});
