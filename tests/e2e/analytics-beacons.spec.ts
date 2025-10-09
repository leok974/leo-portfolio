import { test, expect } from './test.base';
import { captureBeacons, Beacon } from './utils/beacons';

function byType(arr: Beacon[], type: string) {
  return arr.filter(b => b?.type === type);
}

test.describe('@analytics-beacons Client beacon validation (no backend)', () => {
  test.beforeEach(async ({ context }) => {
    // Disable DNT to ensure analytics fires
    await context.setExtraHTTPHeaders({
      'DNT': '0',
    });
  });

  test('fires a page_view on first load', async ({ page, baseURL }) => {
    const beacons = await captureBeacons(page);
    await page.goto(baseURL!, { waitUntil: 'domcontentloaded' });

    // Wait a moment for any async beacon batching
    await page.waitForTimeout(500);

    const views = byType(beacons, 'page_view');
    if (views.length === 0) {
      console.log('All captured beacons:', beacons.map(b => b.type));
    }
    expect(views.length).toBeGreaterThan(0);
    const v = views[0];

    expect(v.path).toBeDefined();
    expect(typeof v.ts === 'number' || typeof v.ts === 'string').toBeTruthy();
    // Analytics is privacy-first - no session tracking
    expect(v.device).toBeDefined();
    expect(['mobile', 'tablet', 'desktop']).toContain(v.device);
  });

  test('emits scroll depth beacon after scrolling', async ({ page, baseURL }) => {
    const beacons = await captureBeacons(page);
    await page.goto(baseURL!, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300); // Let page_view fire first

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);

    const scrolls = byType(beacons, 'scroll_depth');
    expect(scrolls.length).toBeGreaterThan(0);
    // expect a depth field (0..100)
    const last = scrolls[scrolls.length - 1];
    const percent = (last.meta?.percent as number) ?? (last as any).percent ?? 0;
    expect(percent).toBeGreaterThanOrEqual(80); // bottom-ish
  });

  test('tracks outbound link_click (target=_blank safe)', async ({ page, baseURL }) => {
    const beacons = await captureBeacons(page);

    await page.goto(baseURL!, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300); // Let page_view fire first

    // Find an outbound link (fallback: create one temporarily)
    const linkSelector = 'a[href^="http"]:not([href*="localhost"]):not([href*="127.0.0.1"])';
    const hasOutbound = await page.$(linkSelector);
    if (!hasOutbound) {
      await page.evaluate(() => {
        const a = document.createElement('a');
        a.href = 'https://github.com/leok974';
        a.textContent = 'GitHub outbound';
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
      });
    }

    const [popup] = await Promise.all([
      page.waitForEvent('popup').catch(() => null), // may not open if prevented
      page.click(linkSelector).catch(() => null),
    ]);

    if (popup) await popup.close();
    await page.waitForTimeout(200);

    const clicks = byType(beacons, 'link_click');
    expect(clicks.length).toBeGreaterThan(0);
    const c = clicks[0];
    const href = (c.meta?.href as string) ?? (c as any).href ?? '';
    expect(href).toMatch(/^https?:\/\//);
  });

  test('records resume link click as link_click with kind=resume and a dwell ping', async ({ page, baseURL }) => {
    const beacons = await captureBeacons(page);

    // Stub resume endpoint so click doesn't 404 in static mode
    await page.route('**/dl/resume', async (route) => {
      await route.fulfill({ status: 200, body: 'OK' });
    });

    await page.goto(baseURL!, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300); // Let page_view fire first

    // Add a fake resume link if one isn't present
    const resumeSel = 'a[href*="/dl/resume"]';
    const hasResume = await page.$(resumeSel);
    if (!hasResume) {
      await page.evaluate(() => {
        const a = document.createElement('a');
        a.href = '/dl/resume';
        a.setAttribute('data-link-kind', 'resume');
        a.textContent = 'Download resume';
        document.body.appendChild(a);
      });
    }

    await page.click(resumeSel);
    // Simulate some dwell (your beacon might batch every N seconds)
    await page.waitForTimeout(1100);

    // Trigger dwell by hiding the page
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        configurable: true,
        value: 'hidden'
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(200); // Let dwell beacon send

    const resume = byType(beacons, 'link_click');
    // resume link should trigger link_click with kind=resume
    const resumeClick = resume.find(r => (r.meta?.kind as string) ?? (r as any).kind === 'resume');
    expect(resumeClick).toBeTruthy();

    const dwell = byType(beacons, 'dwell');
    expect(dwell.length).toBeGreaterThan(0);
    const seconds = (dwell[0].meta?.seconds as number) ?? (dwell[0] as any).seconds ?? 0;
    expect(seconds).toBeGreaterThan(0.5);
  });
});
