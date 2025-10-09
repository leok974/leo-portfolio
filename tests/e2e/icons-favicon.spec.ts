import { test, expect } from './test.base';
const EXPECT_EDGE = process.env.EXPECT_EDGE === '1' || process.env.NGINX_STRICT === '1';
test.skip(!EXPECT_EDGE, 'Edge headers not expected in static mode');

test.describe('Favicon & Touch Icons', () => {
  const ICONS = [
    '/leo-avatar-sm.png',
    '/leo-avatar-md.png'
  ];

  for (const icon of ICONS) {
    test(`icon ${icon} serves with long cache`, async ({ request, baseURL }) => {
      const url = (baseURL || '') + icon;
      const res = await request.get(url);
      expect(res.status(), 'status should be 200').toBe(200);
      expect(res.headers()['content-type']).toMatch(/image\/png/);
      const cc = res.headers()['cache-control'] || '';
      expect(cc).toMatch(/max-age=31536000/);
      expect(cc).toMatch(/immutable/);
      // Length should be > 0 (not empty placeholder)
      expect(Number(res.headers()['content-length'] || '1')).toBeGreaterThan(0);
    });
  }
});
