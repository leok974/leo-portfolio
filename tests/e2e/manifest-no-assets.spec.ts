import { test, expect } from './test.base';
const BASE = process.env.BASE ?? 'http://localhost:8080';

test.describe('@content manifest-no-assets', () => {
  test('manifest & icons never resolve under /assets', async ({ request }) => {
    const res = await request.get(`${BASE}/manifest.webmanifest`);
    expect(res.ok()).toBeTruthy();
    const man = await res.json();
    const icons = (man.icons || []).map((i: any) => i.src).filter(Boolean);
    for (const src of icons) {
      expect(src.startsWith('/')).toBeTruthy();
      expect(src.startsWith('/assets/')).toBeFalsy();
    }
    // Ensure a hashed /assets manifest variant is not accidentally exposed
    const bad = await request.get(`${BASE}/assets/manifest.webmanifest`);
    expect(bad.status()).toBe(404);
  });
});
