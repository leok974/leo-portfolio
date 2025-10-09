import { test, expect } from './test.base';
import { BASE } from './helpers/env';

const NGINX_STRICT = process.env.NGINX_STRICT === '1';

test('built assets are served with immutable caching (nginx strict)', async ({ page, request }) => {
  test.skip(!NGINX_STRICT, 'Skipping immutable header enforcement outside nginx strict env');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const cssLinks = await page.locator('link[rel="stylesheet"]').all();
  const jsLinks = await page.locator('script[src]').all();
  const targets: string[] = [];
  for (const h of cssLinks.slice(0, 2)) {
    const href = await h.getAttribute('href');
    if (href) targets.push(href);
  }
  for (const s of jsLinks.slice(0, 2)) {
    const src = await s.getAttribute('src');
    if (src) targets.push(src);
  }
  expect(targets.length, 'no asset URLs found on page').toBeGreaterThan(0);
  for (const raw of targets) {
    const url = raw.startsWith('http') ? raw : `${BASE}${raw.startsWith('/') ? '' : '/'}${raw}`;
    const res = await request.get(url);
    expect(res.status(), `GET ${url}`).toBe(200);
    const ct = res.headers()['content-type'] || '';
    expect(/(text\/css|application\/javascript|text\/javascript)/.test(ct)).toBeTruthy();
    const cc = res.headers()['cache-control'] || '';
    expect(cc, `Cache-Control for ${url}`).toMatch(/immutable/);
    expect(cc).toMatch(/max-age=\d+/);
  }
});
