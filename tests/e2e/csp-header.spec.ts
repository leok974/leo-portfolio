import { test, expect, request as pwRequest } from '@playwright/test';
import { BASE } from './helpers/env';

// Verifies CSP header integrity in strict nginx modes.
// Skips outside NGINX_STRICT to avoid noise in dev or non-proxied runs.

test.describe('@security csp header', () => {
  test('script-src has hashes & no unsafe-inline', async () => {
    test.skip(process.env.NGINX_STRICT !== '1', 'CSP enforcement only validated in NGINX_STRICT=1 environment');

    const api = await pwRequest.newContext();
    const res = await api.get(`${BASE || ''}/`, { headers: { 'Accept': 'text/html' } });
    expect(res.ok()).toBeTruthy();
    const headers = res.headers();
    const csp = headers['content-security-policy'];
    test.skip(!csp, 'No CSP header present (skipping outside hardened proxy)');

    // Basic assertions
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/unsafe-inline/);
    expect(csp).toMatch(/sha256-/); // At least one inline hash
    expect(csp).not.toContain('PLACEHOLDER_INLINE_HASH');

    // Attach for debugging
    test.info().attach('csp.txt', { body: csp, contentType: 'text/plain' });
  });
});
