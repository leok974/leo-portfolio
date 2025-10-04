import { test, expect } from '@playwright/test';
import { BASE } from './helpers/env';

interface ManifestIcon { src: string; sizes: string; type: string; purpose?: string }
interface Manifest { icons?: ManifestIcon[] }

const isPng = (ct: string) => /image\/png/.test(ct.toLowerCase());


test.describe('@content manifest icons integrity', () => {
  test('manifest icons resolve from root manifest and are image/png', async ({ request }) => {
    const res = await request.get(`${BASE}/manifest.webmanifest`, { headers: { 'Accept': 'application/manifest+json' } });
    expect(res.status(), 'GET /manifest.webmanifest should be 200').toBe(200);
    const ct = (res.headers()['content-type'] || '').toLowerCase();
    expect(ct.includes('application/manifest+json') || ct.includes('application/json'), `Content-Type for manifest: ${ct}`).toBeTruthy();
    const json: Manifest = await res.json();
    expect(Array.isArray(json.icons), 'manifest.icons should be an array').toBeTruthy();
    expect(json.icons!.length).toBeGreaterThan(0);

    for (const icon of json.icons!) {
      expect(icon.src.startsWith('/'), 'icon src must be root path').toBeTruthy();
      expect(icon.src.includes('/assets/'), 'icon src should not reference /assets/ hashed path').toBeFalsy();
      const r = await request.get(`${BASE}${icon.src}`);
      expect(r.status(), `GET ${icon.src}`).toBe(200);
      const ict = r.headers()['content-type'] || '';
      expect(isPng(ict), `Icon content-type should be image/png, got ${ict}`).toBeTruthy();
  const body = await r.body();
  // Must be non-zero (generation script ensures real PNG bytes)
  expect(body.length, `Icon ${icon.src} should have non-zero length`).toBeGreaterThan(0);
    }
  });
});

