import type { Page } from '@playwright/test';

export async function mockReady(page: Page, servedBy: 'primary' | 'fallback' = 'primary') {
  await page.route('**/api/status/summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ready: true,
        llm: { path: servedBy, model_present: true },
        last_served_by: { provider: servedBy }
      })
    });
  });
}
