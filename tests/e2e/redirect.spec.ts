import { test, expect } from '@playwright/test';

test.describe('Legacy Pages redirect', () => {
  test('github.io portfolio path redirects to unified host', async ({ page }) => {
    test.skip(process.env.SKIP_PAGES_REDIRECT === '1', 'Pages redirect test disabled');

    const legacy = 'https://leok974.github.io/leo-portfolio/';
    await page.goto(legacy, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500); // allow client-side redirect script

    const finalUrl = page.url();
    expect(finalUrl.startsWith('https://assistant.ledger-mind.org')).toBeTruthy();
  });
});
