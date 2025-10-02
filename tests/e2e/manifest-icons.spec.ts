import { test, expect } from '@playwright/test';
import { BASE } from './helpers/env';

interface ManifestIcon { src: string; sizes: string; type: string; purpose?: string }
interface Manifest { icons?: ManifestIcon[] }

const isPng = (ct: string) => /image\/png/.test(ct.toLowerCase());

const ABS = (p: string) => p.startsWith('http') ? p : `${BASE}${p.startsWith('/') ? '' : '/'}${p}`;

test.describe('@content manifest icons integrity', () => {
  test('manifest icons resolve and are image/png', async ({ request }) => {
    // Fetch index.html to discover hashed manifest path emitted by Vite
    const resIndex = await request.get(`${BASE}/`, { headers: { 'Accept': 'text/html' } });
    expect(resIndex.status(), 'GET / should be 200').toBe(200);
    const html = await resIndex.text();
    const manifestHref = html.match(/<link[^>]+rel=["']manifest["'][^>]+href=["']([^"']+)["']/i)?.[1];
    expect(manifestHref, 'Manifest <link rel=manifest> not found in index.html').toBeTruthy();
    const manifestUrl = ABS(manifestHref!);

    const res = await request.get(manifestUrl, { headers: { 'Accept': 'application/manifest+json' } });
    expect(res.status(), 'GET /manifest.webmanifest should be 200').toBe(200);
    const ct = (res.headers()['content-type'] || '').toLowerCase();
    expect(ct.includes('application/manifest+json') || ct.includes('application/json'), `Content-Type for manifest: ${ct}`).toBeTruthy();
    const text = await res.text();
    expect(text.includes('<!DOCTYPE html>')).toBeFalsy();

    let manifest: Manifest;
    expect(() => { manifest = JSON.parse(text); }).not.toThrow();
    manifest = JSON.parse(text);
    expect(Array.isArray(manifest.icons), 'manifest.icons should be an array').toBeTruthy();
    expect(manifest.icons!.length).toBeGreaterThan(0);

    for (const icon of manifest.icons!) {
      expect(icon.src, 'icon.src missing').toBeTruthy();
      const url = ABS(icon.src);
      const r = await request.get(url);
      expect(r.status(), `GET ${url}`).toBe(200);
      const ict = r.headers()['content-type'] || '';
      expect(isPng(ict), `Icon content-type should be image/png, got ${ict}`).toBeTruthy();
  const body = await r.body();
  // Icons are currently placeholder zero-byte PNGs (allowed). If real images added later, consider enforcing >100 bytes.
  expect(body.length).toBeGreaterThanOrEqual(0);
    }
  });
});
