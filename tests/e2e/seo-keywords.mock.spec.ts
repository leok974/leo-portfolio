import { test, expect, request as PWRequest } from '@playwright/test';

const BE = process.env.BACKEND_URL || 'http://127.0.0.1:8001';

test.describe('Phase 50.6 — seo-keywords mock', () => {
  test('POST /agent/seo/keywords/mock writes artifact with integrity', async () => {
    const api = await PWRequest.newContext({
      baseURL: BE,
      extraHTTPHeaders: { Authorization: 'Bearer dev' },
      timeout: 30000
    });

    const res = await api.post('/agent/seo/keywords/mock');
    expect(res.ok()).toBeTruthy();

    const json = await res.json();
    expect(json.ok).toBe(true);

    const payload = json?.payload;
    expect(payload).toBeTruthy();
    expect(payload.mode).toBe('mock');

    // Verify integrity structure
    const integ = payload?.integrity;
    expect(integ?.algo).toBe('sha256');
    expect(typeof integ?.value).toBe('string');
    expect(integ?.value.length).toBeGreaterThanOrEqual(64);
    expect(Number(integ?.size)).toBeGreaterThan(0);

    // Sanity: contains expected pages
    const items = payload?.items || [];
    expect(items.length).toBeGreaterThan(0);

    const pages = items.map((p: any) => p.page);
    expect(pages).toContain('/index.html');
    expect(pages).toContain('/agent.html');

    // Verify index page has expected keywords
    const index = items.find((p: any) => p.page === '/index.html');
    expect(index).toBeTruthy();
    expect(index?.keywords).toBeTruthy();
    expect(Array.isArray(index?.keywords)).toBe(true);
    expect(index?.keywords?.length).toBeGreaterThan(0);

    // Check for portfolio/automation related terms
    const hasExpectedTerms = index?.keywords?.some((k: any) =>
      /autonomous|automation|portfolio/i.test(k.term)
    );
    expect(hasExpectedTerms).toBeTruthy();

    // Verify keyword structure
    const firstKw = index?.keywords?.[0];
    expect(firstKw?.term).toBeTruthy();
    expect(typeof firstKw?.score).toBe('number');
    expect(typeof firstKw?.trend).toBe('number');
    expect(firstKw?.score).toBeGreaterThan(0);
    expect(firstKw?.score).toBeLessThanOrEqual(1);
    expect(firstKw?.trend).toBeGreaterThanOrEqual(0);
    expect(firstKw?.trend).toBeLessThanOrEqual(100);

    await api.dispose();
  });

  test('GET /agent/seo/keywords/mock returns last artifact', async () => {
    const api = await PWRequest.newContext({
      baseURL: BE,
      extraHTTPHeaders: { Authorization: 'Bearer dev' },
      timeout: 30000
    });

    const res = await api.get('/agent/seo/keywords/mock');
    expect(res.ok()).toBeTruthy();

    const json = await res.json();
    expect(json).toBeTruthy();
    expect(json.mode).toBe('mock');

    // Verify integrity
    expect(json?.integrity?.algo).toBe('sha256');
    expect(json?.integrity?.value).toBeTruthy();
    expect(json?.integrity?.value.length).toBeGreaterThanOrEqual(64);

    // Verify structure
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.items.length).toBeGreaterThan(0);

    await api.dispose();
  });

  test('mock artifacts include both pages with keywords', async () => {
    const api = await PWRequest.newContext({
      baseURL: BE,
      extraHTTPHeaders: { Authorization: 'Bearer dev' },
      timeout: 30000
    });

    // Generate fresh artifacts
    await api.post('/agent/seo/keywords/mock');

    // Fetch via GET
    const res = await api.get('/agent/seo/keywords/mock');
    const json = await res.json();

    // Verify both pages
    const indexPage = json.items.find((p: any) => p.page === '/index.html');
    const agentPage = json.items.find((p: any) => p.page === '/agent.html');

    expect(indexPage).toBeTruthy();
    expect(agentPage).toBeTruthy();

    // Verify each page has keywords
    expect(indexPage.keywords.length).toBeGreaterThan(0);
    expect(agentPage.keywords.length).toBeGreaterThan(0);

    // Verify page metadata
    expect(indexPage.title).toContain('SiteAgent');
    expect(agentPage.title).toContain('Manifesto');

    await api.dispose();
  });
});
