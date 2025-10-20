import { test, expect } from '@playwright/test';

test('resume CTA renders exactly two actions with correct behavior', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__APP_READY__ === true);

  const cta = page.getByTestId('resume-cta');
  await expect(cta).toBeVisible();
  await expect(cta.getByRole('link', { name: /resume \(pdf\)/i })).toHaveCount(1);
  await expect(cta.getByRole('button', { name: /copy for linkedin/i })).toHaveCount(1);

  // no extra clickable elements that point to the PDF (except social link)
  const allLinks = await page.locator('a[href$=".pdf"]').count();
  // We expect 3: 1 in social links + 2 in ResumeCta components (about + contact sections)
  expect(allLinks).toBe(3);
});

test('footer rights text is not a link', async ({ page }) => {
  await page.goto('/');
  const rights = page.getByTestId('footer-rights');
  await expect(rights).toBeVisible();
  // Ensure it is not rendered as an anchor
  const tag = await rights.evaluate(el => el.tagName.toLowerCase());
  expect(tag).toBe('p');
});

test('no nested anchors exist', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__APP_READY__ === true);

  // Check for any nested anchor tags (a inside a)
  const nestedAnchors = await page.locator('a a').count();
  expect(nestedAnchors).toBe(0);
});

test('copy for linkedin button works', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__APP_READY__ === true);

  // Grant clipboard permissions
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  const copyBtn = page.getByTestId('copy-linkedin').first();
  await copyBtn.click();

  // Verify clipboard content
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain('Leo Klemet');
  expect(clipboardText).toContain('https://www.leoklemet.com');
  expect(clipboardText).toContain('Resume (PDF)');
});
