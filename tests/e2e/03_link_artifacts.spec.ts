import { test, expect } from './test.base';
import { requireBackendOrSkip } from './_utils';
import fs from 'node:fs';
import path from 'node:path';

function write(p: string, txt: string | Buffer) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, txt);
}

test('commit link fixes produces artifacts and copy-to-clipboard works', async ({ page, request }) => {
  await requireBackendOrSkip(request);
  // Seed data files
  write('public/tmp-e2e/index.html', '<a href="img/hero.png">x</a><img src="img/hero.png">');
  write('public/tmp-e2e/img/hero-final.png', 'x');
  write('assets/data/link-check.json', JSON.stringify({ missing: [{ file: 'public/tmp-e2e/index.html', url: 'img/hero.png' }] }, null, 2));
  write('assets/data/link-suggest.json', JSON.stringify({ suggestions: { 'img/hero.png': ['public/tmp-e2e/img/hero-final.png'] } }, null, 2));

  await page.goto('/?dev=1');
  await page.getByRole('button', { name: /maintenance \(dev\)/i }).click();
  await page.getByRole('button', { name: /commit link fixes/i }).click();

  // Artifacts block should show json and diff
  await expect(page.locator('#sa-arts a', { hasText: 'link-apply.json' })).toBeVisible({ timeout: 15000 });
  // The diff may take a moment; allow some extra time
  await expect(page.locator('#sa-arts a', { hasText: 'link-apply.diff' })).toBeVisible({ timeout: 20000 });

  // Copy PR markdown
  const btn = page.locator('#sa-copy-pr');
  await expect(btn).toBeVisible();
  await btn.click();
  // Validate clipboard content
  const md = await page.evaluate(() => navigator.clipboard.readText());
  expect(md).toContain('# siteAgent — Automated Link Fixes');
  expect(md).toContain('```diff');
});
