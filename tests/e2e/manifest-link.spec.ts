import { test, expect } from '@playwright/test';
import { BASE } from './helpers/env';

test.describe('@content manifest link', () => {
  test('manifest <link> points to /manifest.webmanifest and is reachable', async ({ request }) => {
    const res = await request.get(`${BASE}/`);
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    const href = (html.match(/<link\s+[^>]*rel=["']manifest["'][^>]*href=["']([^"']+)["']/i)?.[1]) ?? '';
    expect(href).toBe('/manifest.webmanifest');
    const man = await request.get(`${BASE}${href}`);
    expect(man.ok()).toBeTruthy();
    const ct = (man.headers()['content-type'] || '').toLowerCase();
    expect(ct.includes('application/manifest+json') || ct.includes('application/json')).toBeTruthy();
  });
});
