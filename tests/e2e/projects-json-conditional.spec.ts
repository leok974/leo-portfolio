import { test, expect } from '@playwright/test';
import { BASE } from './helpers/env';

test.describe('@content projects.json conditional cache', () => {
  test('responds 304 to If-None-Match / If-Modified-Since', async ({ request }) => {
    test.skip(!process.env.NGINX_STRICT, 'strict only');

    const first = await request.get(`${BASE}/projects.json`, { headers: { 'Cache-Control': 'no-cache' } });
    expect(first.status(), 'initial GET /projects.json').toBe(200);

    const etag = first.headers()['etag'];
    const lastMod = first.headers()['last-modified'];

    if (etag) {
      const second = await request.get(`${BASE}/projects.json`, { headers: { 'If-None-Match': etag } });
      expect(second.status(), 'ETag conditional should 304').toBe(304);
    } else if (lastMod) {
      const second = await request.get(`${BASE}/projects.json`, { headers: { 'If-Modified-Since': lastMod } });
      expect(second.status(), 'Last-Modified conditional should 304').toBe(304);
    } else {
      test.skip(true, 'server exposes neither ETag nor Last-Modified (skipping)');
    }
  });
});
