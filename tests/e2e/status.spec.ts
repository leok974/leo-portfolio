import { test, expect } from '@playwright/test';

// Basic production status pill + endpoints validation

test.describe('Prod status pill', () => {
  test('pill reaches a healthy (non-error) state', async ({ page, request, baseURL }) => {
    test.skip(process.env.CI && process.env.SKIP_E2E === '1', 'E2E disabled by env');

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Title heuristic (non-fatal if mismatch, but ensures page loaded real content)
    await expect(page).toHaveTitle(/leo|portfolio|assistant/i);

    const pill = page.locator('#agentStatusPill');
    await expect(pill).toBeVisible();

    // Allow fallback chain to resolve
    await page.waitForTimeout(1500);
    const cls = (await pill.getAttribute('class')) || '';
    expect(cls.includes('error')).toBeFalsy();

    // Backend ready endpoint sanity
    const ready = await request.get(`${baseURL}/api/ready`);
    expect(ready.status()).toBe(200);
  });

  test('status summary endpoint responds', async ({ request, baseURL }) => {
    const r = await request.get(`${baseURL}/status/summary`);
    expect([200, 503]).toContain(r.status());
    if (r.status() === 200) {
      const j = await r.json();
      expect(j).toHaveProperty('ok', true);
    }
  });
});
