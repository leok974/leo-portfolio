import { test, expect } from './test.base';
import { requireBackendOrSkip } from './_utils';

test('maintenance overlay opens and lists actions', async ({ page, request }) => {
  await requireBackendOrSkip(request);
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: /maintenance \(dev\)/i }).click();
  // Quick plan
  await page.getByRole('button', { name: /run quick/i }).click();
  // Wait for events to populate
  await expect(page.locator('#sa-evts li').first()).toBeVisible({ timeout: 15000 });
  const count = await page.locator('#sa-evts li').count();
  expect(count).toBeGreaterThan(0);
});
