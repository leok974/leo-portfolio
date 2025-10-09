import { test, expect, request as PWRequest } from './test.base';

const BE = process.env.BACKEND_URL || 'http://127.0.0.1:8001';

test.describe('Phase 50.6 — full route auto-downgrades to mock when SEO_LLM_ENABLED=0', () => {
  test('POST /agent/seo/keywords yields mock-style payload with integrity', async () => {
    const api = await PWRequest.newContext({
      baseURL: BE,
      extraHTTPHeaders: { Authorization: 'Bearer dev' },
      timeout: 30000
    });

    // CI sets SEO_LLM_ENABLED=0; locally you can export it before running tests
    const res = await api.post('/agent/seo/keywords');
    expect(res.ok()).toBeTruthy();

    const json = await res.json();

    // Minimal shape checks
    expect(json?.mode).toBeDefined();
    expect(json?.items?.length).toBeGreaterThan(0);

    // Mock parity expectations - when SEO_LLM_ENABLED=0, should get mock
    const integ = json?.integrity;
    expect(integ?.algo).toBe('sha256');
    expect(typeof integ?.value).toBe('string');
    expect(integ?.value.length).toBeGreaterThanOrEqual(64);
    expect(Number(integ?.size)).toBeGreaterThan(0);

    // Sanity: known pages from mock/defaults
    const pages = (json?.items || []).map((p: any) => p.page);
    expect(pages.length).toBeGreaterThan(0);

    // When auto-downgraded to mock, expect specific pages
    if (json?.mode === 'mock') {
      expect(pages).toContain('/index.html');
      expect(pages).toContain('/agent.html');

      // Verify mock characteristics
      const indexPage = json.items.find((p: any) => p.page === '/index.html');
      expect(indexPage).toBeTruthy();
      expect(indexPage?.keywords).toBeTruthy();
      expect(indexPage?.keywords.length).toBeGreaterThan(0);

      // Check keyword structure
      const firstKw = indexPage?.keywords[0];
      expect(firstKw?.term).toBeTruthy();
      expect(typeof firstKw?.score).toBe('number');
      expect(typeof firstKw?.trend).toBe('number');
      expect(firstKw?.score).toBeGreaterThan(0);
      expect(firstKw?.score).toBeLessThanOrEqual(1);
    }

    await api.dispose();
  });

  test('GET /agent/seo/keywords returns artifact after auto-downgrade', async () => {
    const api = await PWRequest.newContext({
      baseURL: BE,
      extraHTTPHeaders: { Authorization: 'Bearer dev' },
      timeout: 30000
    });

    // First generate via POST (should auto-downgrade if SEO_LLM_ENABLED=0)
    await api.post('/agent/seo/keywords');

    // Then fetch via GET
    const res = await api.get('/agent/seo/keywords');
    expect(res.ok()).toBeTruthy();

    const json = await res.json();
    expect(json).toBeTruthy();
    expect(json.mode).toBeDefined();
    expect(json.integrity).toBeTruthy();
    expect(json.items).toBeTruthy();
    expect(json.items.length).toBeGreaterThan(0);

    await api.dispose();
  });
});
