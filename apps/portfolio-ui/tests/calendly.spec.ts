import { test, expect } from '@playwright/test';

test('Calendly renders centered and sane size', async ({ page }) => {
  await page.goto('/#contact');
  const widget = page.locator('.calendly-inline-widget iframe');
  await expect(widget).toBeVisible({ timeout: 15000 });
  const box = await widget.boundingBox();
  expect(box && box.height > 500 && box.height < 900).toBeTruthy();
  await expect(page.locator('.calendly-wrap')).toBeVisible();
});
