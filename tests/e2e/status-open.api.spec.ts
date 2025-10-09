/**
 * E2E Tests: Status Open API (dev-only)
 *
 * Tests the /agent/status/open endpoint for viewing underlying HTML files.
 * Requires ALLOW_DEV_ROUTES=1 to test successfully.
 */
import { test, expect } from './test.base';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8001';

test.describe('status open API (dev-only)', () => {
  test('GET /agent/status/open (meta) returns abs_path and hint_raw_url', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/agent/status/open`, {
      params: { path: '/index.html' }
    });

    // When ALLOW_DEV_ROUTES=1 and /index.html exists in public/dist
    expect([200, 404, 403]).toContain(res.status());

    if (res.status() === 200) {
      const j = await res.json();
      expect(j.ok).toBe(true);
      expect(j.abs_path).toBeTruthy();
      expect(typeof j.abs_path).toBe('string');
      expect(j.size).toBeGreaterThan(0);
      expect(j.mtime).toBeTruthy();
      expect(j.hint_raw_url).toContain('/agent/status/open?path=');
      expect(j.hint_raw_url).toContain('&raw=1');

      console.log(`✅ Metadata for /index.html: ${j.abs_path} (${j.size} bytes)`);
    } else if (res.status() === 403) {
      console.log('⚠️  Dev routes disabled (ALLOW_DEV_ROUTES not set)');
    } else if (res.status() === 404) {
      console.log('⚠️  /index.html not found in public dirs');
    }
  });

  test('GET /agent/status/open?raw=1 streams HTML when file exists', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/agent/status/open`, {
      params: { path: '/index.html', raw: 1 }
    });

    expect([200, 404, 403, 413]).toContain(res.status());

    if (res.status() === 200) {
      const ct = res.headers()['content-type'] || '';
      expect(ct).toMatch(/text\/html|text\/plain/);

      const body = await res.text();
      expect(body.length).toBeGreaterThan(0);

      // Check for common HTML markers
      const hasHtml = body.toLowerCase().includes('<html') ||
                      body.toLowerCase().includes('<!doctype');

      console.log(`✅ Raw HTML streamed: ${body.length} bytes, has HTML markers: ${hasHtml}`);

      // Verify X-Resolved-Path header is present
      const resolvedPath = res.headers()['x-resolved-path'];
      expect(resolvedPath).toBeTruthy();
      console.log(`   Resolved path: ${resolvedPath}`);
    } else if (res.status() === 403) {
      console.log('⚠️  Dev routes disabled (ALLOW_DEV_ROUTES not set)');
    } else if (res.status() === 404) {
      console.log('⚠️  /index.html not found in public dirs');
    } else if (res.status() === 413) {
      console.log('⚠️  File too large for raw view (>2MB)');
    }
  });

  test('GET /agent/status/open rejects path traversal attempts', async ({ request }) => {
    const maliciousPaths = [
      '/../etc/passwd',
      '/../../secret.txt',
      '/../assistant_api/settings.py',
    ];

    for (const badPath of maliciousPaths) {
      const res = await request.get(`${BACKEND_URL}/agent/status/open`, {
        params: { path: badPath }
      });

      // Should be 404 (not found due to traversal guard) or 403 (dev routes disabled)
      expect([404, 403]).toContain(res.status());

      if (res.status() === 404) {
        console.log(`✅ Traversal blocked: ${badPath} → 404`);
      }
    }
  });

  test('GET /agent/status/open requires leading slash', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/agent/status/open`, {
      params: { path: 'index.html' }  // Missing leading slash
    });

    expect([400, 403]).toContain(res.status());

    if (res.status() === 400) {
      const j = await res.json();
      expect(j.detail).toContain('must be site-relative');
      console.log('✅ Rejected path without leading slash');
    }
  });
});
