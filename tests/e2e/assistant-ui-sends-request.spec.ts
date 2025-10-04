import { test, expect } from '@playwright/test';
import { mockReady } from './lib/mock-ready';
import { installFastUI } from './lib/fast-ui';

// Validates that the UI emits a POST against the forced shim without relying on a real backend.
test.describe('@frontend assistant UI emits stream request', () => {
  test.setTimeout(30_000);

  test.beforeEach(async ({ page }) => {
    await installFastUI(page);
    await mockReady(page, 'primary');
  });

  test('Send triggers POST /api/chat/stream', async ({ page }) => {
    const requestPromise = page.waitForRequest((request) => {
      return request.method() === 'POST' && /\/api\/chat\/stream$/.test(request.url());
    });

    await page.route('**/api/chat/stream', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream; charset=utf-8' },
        body: 'event: done\n\ndata: {}\n\n',
      });
    });
    await page.goto('/root_playwright.html');
    await page.locator('#assistantChip').click();
    const input = page.locator('[data-testid="assistant-input"], #chatInput').first();
    const send = page.locator('[data-testid="assistant-send"], #chatSend').first();
    await expect(input).toBeVisible();
    await input.fill('anything');
    await send.click();

    const req = await requestPromise;
    expect(req.postDataJSON()).toHaveProperty('messages');
  });
});
