import { test, expect } from './test.base';
import { BASE } from './helpers/env';

// Ultra-fast cache header smoke: ensures HTML shell not immutable, one JS is immutable.

test.describe('@security cache smoke', () => {
  test('index is not immutable; one asset is immutable', async ({ request }) => {
    test.skip(!process.env.NGINX_STRICT, 'strict only');

    const resRoot = await request.get(`${BASE}/`, { headers: { Accept: 'text/html' } });
    expect(resRoot.status()).toBe(200);
    const ctRoot = (resRoot.headers()['content-type'] || '').toLowerCase();
    const ccRoot = (resRoot.headers()['cache-control'] || '').toLowerCase();
    expect(ctRoot).toContain('text/html');
    expect(ccRoot.includes('immutable')).toBeFalsy();

    const html = await resRoot.text();
    const js = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+\.m?js(?:[?#].*)?)["']/gi)).map(m => m[1])[0];
    expect(js, 'no <script src=*.js> in index.html').toBeTruthy();

    const url = js.startsWith('http') ? js : `${BASE}${js.startsWith('/') ? '' : '/'}${js}`;
    const resJs = await request.get(url);
    const ccJs = (resJs.headers()['cache-control'] || '').toLowerCase();
    const ctJs = (resJs.headers()['content-type'] || '').toLowerCase();

    expect(resJs.status()).toBe(200);
    expect(/application\/javascript|text\/javascript/.test(ctJs)).toBeTruthy();
    expect(ccJs).toMatch(/immutable/);
    expect(ccJs).toMatch(/max-age=\d+/);
  });
});
