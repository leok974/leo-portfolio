import { test, expect } from '@playwright/test';
import { BASE } from './helpers/env';

function lower(h: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : (v ?? '');
  return out;
}

test.describe('@security headers drift', () => {
  test('core headers present on /', async ({ request }) => {
    test.skip(!process.env.NGINX_STRICT, 'strict only');

    const r = await request.get(`${BASE}/`, { headers: { Accept: 'text/html' } });
    expect(r.status(), 'GET /').toBe(200);

    const h = lower(r.headers());
    expect(h['content-type']).toContain('text/html');

    // Hardened basics
    expect(h['x-content-type-options']).toBe('nosniff');
    expect((h['x-frame-options'] || '').toUpperCase()).toBe('DENY');
    expect(h['referrer-policy']).toBe('no-referrer');

    // Permissions-Policy should deny these capabilities
    const pp = h['permissions-policy'] || '';
    for (const k of ['camera=()', 'microphone=()', 'geolocation=()']) {
      expect(pp.includes(k), `permissions-policy missing ${k}`).toBeTruthy();
    }

    // CSP present with a sha256 inline hash (your CSP test validates more deeply)
    const csp = h['content-security-policy'] || '';
    expect(csp.length, 'CSP header missing').toBeGreaterThan(0);
    expect(csp.includes('sha256-'), 'CSP should include a sha256- hash').toBeTruthy();

    if (h['x-config']) test.info().annotations.push({ type: 'note', description: `X-Config=${h['x-config']}` });
  });
});
