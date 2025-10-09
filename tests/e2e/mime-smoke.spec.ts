import { test, expect } from './test.base';

// Reuse BASE from env pattern in other specs (fallback to localhost)
const BASE = process.env.BASE || 'http://localhost:8080';

/*
 Ultra-fast MIME verification:
  - Pull index.html
  - Extract first JS + CSS references
  - Fetch each and assert correct Content-Type and 200 status
  - Gated by NGINX_STRICT so it only runs in strict mode / CI security pass
*/

test.describe('@security mime smoke', () => {
  test('one js & one css from index have correct MIME', async ({ request }) => {
    test.skip(!process.env.NGINX_STRICT, 'strict only');
    const res = await request.get(`${BASE}/`);
    expect(res.status(), 'index.html should load').toBe(200);
    const html = await res.text();
    const refs = Array.from(html.matchAll(/<(?:script|link)[^>]+?(?:src|href)=["']([^"']+)["']/gi)).map(m => m[1]);
    const js = refs.find(u => /\.m?js(\?|#|$)/i.test(u));
    const css = refs.find(u => /\.css(\?|#|$)/i.test(u));
    expect(js, 'a JS asset ref should exist').toBeTruthy();
    expect(css, 'a CSS asset ref should exist').toBeTruthy();
    for (const rel of [js!, css!]) {
      const url = rel.startsWith('http') ? rel : `${BASE}${rel.startsWith('/') ? '' : '/'}${rel}`;
      const r = await request.get(url);
      const ct = (r.headers()['content-type'] || '').toLowerCase();
      expect(r.status(), `asset ${rel} status`).toBe(200);
      if (/\.css/i.test(rel)) {
        expect(ct.includes('text/css'), `css content-type (${ct})`).toBeTruthy();
      } else {
        expect(/application\/javascript|text\/javascript/.test(ct), `js content-type (${ct})`).toBeTruthy();
      }
    }
  });
});
