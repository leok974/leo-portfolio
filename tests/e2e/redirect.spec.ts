import { test, expect } from './test.base';

const BASE = process.env.BASE || 'http://127.0.0.1:8080';
const isGithubPages = /(?:^|\.)github\.io/i.test(BASE);
const isProdHost = /ledger-mind\.org/i.test(BASE);

test.describe('Legacy Pages redirect', () => {
  test((isGithubPages || isProdHost) ? 'redirects to unified host' : 'redirects: local (skipped)', async ({ page }) => {
    test.skip(!(isGithubPages || isProdHost), 'Local/dev base does not redirect; meaningful only on Pages/CDN');
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/(github\.io|ledger-mind\.org)/i);
  });
});
