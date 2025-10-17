import { test, expect } from '@playwright/test';

test('POST /chat is handled (no 405)', async ({ page }) => {
  if (process.env.E2E_NO_SERVER === '1') {
    await page.route('**/chat', route => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            id:'mock-chat',
            choices:[{ message:{ role:'assistant', content:'Hello from mock!' } }],
            _served_by:'mock'
          })
        });
      }
      return route.fallback();
    });
  }

  await page.goto('/');
  await page.fill('#assistant-panel textarea, #assistant-panel input[type="text"]', 'hi');
  await page.click('#assistant-panel button:has-text("Send")');

  if (process.env.E2E_NO_SERVER === '1') {
    await expect(page.locator('#assistant-panel')).toContainText('Hello from mock!');
  } else {
    await expect(page.locator('#assistant-panel')).not.toContainText('[error] Error: chat failed: 405');
  }
});
