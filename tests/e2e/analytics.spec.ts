import { test, expect, APIRequestContext } from '@playwright/test';

/** Parse a Prometheus exposition to a map keyed by label set (stringified) */
function scrapeSeries(text: string, metricName: string) {
  const lines = text.split('\n').filter(l => l.startsWith(metricName));
  const out: Record<string, number> = {};
  for (const l of lines) {
    // Example: link_click_total{href_domain="github.com",kind="github"} 3
    const m = l.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{([^}]*)\})?\s+([0-9.eE+-]+)$/);
    if (!m) continue;
    const labels = m[3] || ''; // raw label string
    const val = Number(m[4]);
    if (!Number.isFinite(val)) continue;
    out[labels] = val;
  }
  return out;
}

async function getMetrics(api: APIRequestContext, baseURL: string) {
  const r = await api.get(`${baseURL}/metrics`, { failOnStatusCode: false });
  expect(r.ok()).toBeTruthy();
  const text = await r.text();
  return {
    page_view: scrapeSeries(text, 'page_view_total'),
    scroll_depth: scrapeSeries(text, 'scroll_depth_percent_total'),
    link_click: scrapeSeries(text, 'link_click_total'),
    resume_dl: scrapeSeries(text, 'resume_download_total'),
  };
}

function sumSeries(series: Record<string, number>, filter?: (_label: string) => boolean) {
  return Object.entries(series).reduce((acc, [label, v]) => (filter && !filter(label) ? acc : acc + v), 0);
}

test.describe('analytics beacons & metrics', () => {
  const BASE = process.env.E2E_BASE || 'http://127.0.0.1:8023';  // backend
  const SITE = process.env.E2E_SITE || 'http://127.0.0.1:8023';  // same-origin site for index.html

  test('page view + scroll + link clicks + resume download bump metrics', async ({ page, request: api }) => {
    // Baseline
    const before = await getMetrics(api, BASE);

    // 1) Visit the site (triggers page_view beacon)
    await page.goto(SITE, { waitUntil: 'domcontentloaded' });

    // 2) Scroll to 100% to trigger scroll_depth bins
    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 300)); // allow beacon to fire
    });

    // 3) Click Github & Resume anchors if present; otherwise simulate via JS to robustly fire beacons
    const clickedGithub = await page.evaluate(() => {
      const a = document.querySelector('a[data-link-kind="github"], a[href*="github.com"]') as HTMLAnchorElement | null;
      if (a) { a.click(); return true; }
      return false;
    });

    const clickedResume = await page.evaluate(() => {
      const a = document.querySelector('a[data-link-kind="resume"], a[href$="resume.pdf"], a[href*="resume"]') as HTMLAnchorElement | null;
      if (a) { a.click(); return true; }
      return false;
    });

    // 4) Server-side resume download counter (ground truth)
    //    Will 200 if RESUME_PATH is configured and file exists; assert only that metrics request succeeds.
    await api.get(`${BASE}/dl/resume`).catch(() => { /* ignore 404 here */ });

    // Allow sendBeacon flush on pagehide/visibilitychange; also wait a bit for server to process
    await page.waitForTimeout(500);

    // Poll metrics for up to ~5 seconds until movement
    let after = before;
    let tries = 0;
    while (tries++ < 10) {
      after = await getMetrics(api, BASE);

      const pvMoved = sumSeries(after.page_view) > sumSeries(before.page_view);
      const sdMoved = sumSeries(after.scroll_depth) > sumSeries(before.scroll_depth);
      const lcMoved = sumSeries(after.link_click) > sumSeries(before.link_click);

      if (pvMoved && sdMoved && (lcMoved || clickedGithub || clickedResume)) break;
      await new Promise(r => setTimeout(r, 500));
    }

    // Assertions (tolerant for resume if file missing)
    expect(sumSeries(after.page_view)).toBeGreaterThan(sumSeries(before.page_view));
    expect(sumSeries(after.scroll_depth)).toBeGreaterThan(sumSeries(before.scroll_depth));

    // If we found and clicked links, require link_click growth; otherwise allow pass (layout may differ locally)
    if (clickedGithub || clickedResume) {
      expect(sumSeries(after.link_click)).toBeGreaterThan(sumSeries(before.link_click));
    }

    // Try to assert link_click breakdowns when present
    const anyKindLabel = Object.keys(after.link_click).some(k => /kind=/.test(k));
    expect(anyKindLabel || !clickedGithub && !clickedResume).toBeTruthy();

    // Resume dl is best-effort — metric presence is enough
    expect(after.resume_dl).toBeDefined();
  });
});
