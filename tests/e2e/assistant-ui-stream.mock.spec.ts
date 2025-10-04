import { test, expect } from '@playwright/test';
import { mockReady } from './lib/mock-ready';
import { installFastUI } from './lib/fast-ui';

const STREAM_BODY = [
  'event: meta',
  'data: {"_served_by":{"provider":"primary"}}',
  '',
  'event: data',
  'data: {"choices":[{"delta":{"content":"hello "}}]}',
  '',
  'event: data',
  'data: {"choices":[{"delta":{"content":"world"}}]}',
  '',
  'event: done',
  'data: {}',
  '',
].join('\n');

// These tests run without the real backend; they validate UI wiring only.
test.describe('@frontend assistant UI stream (mock)', () => {
  test.setTimeout(30_000);

  test.beforeEach(async ({ page }) => {
    await installFastUI(page);
    await mockReady(page, 'primary');
  });

  test('clicking Send posts to /api/chat/stream and renders tokens', async ({ page }) => {
    await page.route('**/api/chat/stream', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          'x-test-sse': '1',
        },
        body: STREAM_BODY,
      });
    });
    await page.goto('/root_playwright.html');
    await page.locator('#assistantChip').click();
    const input = page.locator('[data-testid="assistant-input"], #chatInput').first();
    const send = page.locator('[data-testid="assistant-send"], #chatSend').first();
    await expect(input).toBeVisible();
    await input.fill('say hi');
    await send.click();

    const srOutput = page.locator('[data-testid="assistant-output"]');
    const hasSrOutput = await srOutput.count();
    const fallbackOutput = page.locator('.chat-log .msg.from-ai').last();
    const output = hasSrOutput ? srOutput : fallbackOutput;
    await expect(output).toContainText(/hello\s*world/i, { timeout: 5000 });
  });
});
