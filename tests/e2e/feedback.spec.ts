import { test, expect } from './test.base';

const BASE = process.env.BASE || 'http://127.0.0.1:5178';
const API_BASE = process.env.API_BASE || BASE;

test.describe('Feedback capture', () => {
  test.beforeEach(async ({ page }) => {
    // Force the app to talk to our chosen backend
    await page.addInitScript((apiBase) => { (window as any).__API_BASE__ = apiBase; }, API_BASE);
    // Hide admin dock during this spec to avoid click interception over the chip
    await page.addInitScript(() => { (window as any).__HIDE_ADMIN_DOCK__ = true; });
  });

  test('thumbs-down posts feedback + appears in recent', async ({ page }) => {
    await page.goto(BASE + '/');

    // Open the assistant dock first so the input becomes visible
    const chip = page.getByRole('button', { name: /ask about my projects/i });
    await chip.click();

  // Ask the assistant something trivial to get one reply
    const input = page.getByPlaceholder(/ask about my projects/i);
    await expect(input).toBeVisible();
    await input.click();
    await input.fill('hello from e2e');
  await input.press('Enter');

  // Wait for the feedback bar to be appended under the assistant reply
  const needsWork = page.getByRole('button', { name: /needs work/i });
  await expect(needsWork).toBeVisible({ timeout: 60000 });

    // Accept the prompt note when we click 👎
    page.on('dialog', d => d.accept('e2e thumbs-down'));

  // Click the “Needs work” button under the last assistant reply
  await needsWork.click();

    // Poll /api/feedback/recent until our note appears
    let newest: any = null;
    for (let i = 0; i < 14; i++) {
      const json = await page.evaluate(async () => {
        try {
          const r = await fetch('/api/feedback/recent?limit=5', { cache: 'no-store' });
          if (!r.ok) return null;
          return await r.json();
        } catch { return null; }
      });
      const items = (json?.items ?? []) as any[];
      if (items?.length) {
        newest = items[0];
        if (String(newest.note || '').includes('e2e thumbs-down')) break;
      }
      await page.waitForTimeout(750);
    }
    expect(newest).toBeTruthy();
    expect(newest.score).toBeLessThan(0); // 👎
    expect(String(newest.note || '')).toContain('e2e thumbs-down');
    expect(newest).toHaveProperty('route');
  });
});
