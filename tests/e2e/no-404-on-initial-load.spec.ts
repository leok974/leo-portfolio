import { test, expect, request as playwrightRequest } from './test.base';
import { BASE } from './helpers/env';

// Helper to detect if backend is available (responds on /ready)
async function backendUp(): Promise<boolean> {
  try {
    const ctx = await playwrightRequest.newContext();
    const res = await ctx.get(`${BASE}/ready`);
    return res.ok();
  } catch {
    return false;
  }
}

test.describe('@content no-404', () => {
  test('no unexpected 4xx/5xx network responses during initial page load', async ({ page }) => {
    const apiExpectedMissing = !(await backendUp());
    const bad: { url: string; status: number }[] = [];
    page.on('response', async (resp) => {
      const url = resp.url();
      if (!url.startsWith(BASE)) return;
      const status = resp.status();
      if (status >= 400) {
        // Ignore API/backend paths if backend not running (static dist serve scenario)
        if (apiExpectedMissing && /(\/api\/|\/llm\/|\/ready$|\/metrics$)/.test(url)) return;
        bad.push({ url, status });
      }
    });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    expect(bad, `Unexpected failing responses: ${bad.map(b => `${b.status} ${b.url}`).join(', ')}`).toHaveLength(0);
  });
});
