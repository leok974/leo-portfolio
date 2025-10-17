import { test, expect } from '@playwright/test';

test('Hide toggles and persists across reload', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('#assistant-panel');
  const btn = page.locator('#assistant-hide-btn');

  await expect(panel).toBeVisible();
  await btn.click();
  await expect(panel).toBeHidden();

  await page.reload();
  await expect(panel).toBeHidden();

  await btn.click();
  await expect(panel).toBeVisible();
});
