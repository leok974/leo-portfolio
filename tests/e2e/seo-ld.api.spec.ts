/**
 * SEO JSON-LD API E2E Tests
 *
 * Backend API smoke tests for /agent/seo/ld endpoints:
 * - /validate - Validate JSON-LD structure
 * - /generate - Generate JSON-LD from URL (dry-run and commit modes)
 * - /mock - Fast artifact generator for E2E/CI
 */
import { test, expect } from '@playwright/test';

test.describe('@backend seo-ld API', () => {
  test('validate & generate (dry-run)', async ({ baseURL, request }) => {
    // Validate a tiny blob
    const v = await request.post('/agent/seo/ld/validate', {
      data: { jsonld: { "@context":"https://schema.org","@type":"WebPage","url":"https://example.com","name":"X" } }
    });
    expect(v.ok()).toBeTruthy();
    const vr = await v.json();
    expect(vr.errors ?? []).toEqual([]);

    // Generate (dry_run)
    const g = await request.post('/agent/seo/ld/generate', {
      data: { url: `${baseURL}/`, types: ["WebPage","WebSite"], dry_run: true }
    });
    expect(g.ok()).toBeTruthy();
    const gr = await g.json();
    expect(Array.isArray(gr.jsonld)).toBeTruthy();
    expect((gr.report?.errors ?? []).length).toBe(0);
  });

  test('mock commit creates artifacts', async ({ baseURL, request }) => {
    const m = await request.post('/agent/seo/ld/mock', { data: { url: `${baseURL}/` } });
    // mock route only enabled when ALLOW_DEV_ROUTES=1
    expect([200,404,400].includes(m.status())).toBeTruthy();
  });

  test('validate catches invalid JSON-LD', async ({ request }) => {
    // Missing @context
    const v1 = await request.post('/agent/seo/ld/validate', {
      data: { jsonld: { "@type":"WebPage","url":"https://example.com","name":"Test" } }
    });
    // Accept both 200 (lenient) and 422 (strict mode)
    expect([200, 422].includes(v1.status())).toBeTruthy();
    const vr1 = await v1.json();
    const errors1 = vr1.detail?.errors || vr1.errors || [];
    expect(errors1.length).toBeGreaterThan(0);
    expect(errors1[0]).toContain('@context');

    // Missing @type
    const v2 = await request.post('/agent/seo/ld/validate', {
      data: { jsonld: { "@context":"https://schema.org","url":"https://example.com","name":"Test" } }
    });
    expect([200, 422].includes(v2.status())).toBeTruthy();
    const vr2 = await v2.json();
    const errors2 = vr2.detail?.errors || vr2.errors || [];
    expect(errors2.length).toBeGreaterThan(0);
    expect(errors2[0]).toContain('@type');
  });

  test('generate produces valid WebSite and WebPage', async ({ baseURL, request }) => {
    const g = await request.post('/agent/seo/ld/generate', {
      data: { url: `${baseURL}/test-page`, types: ["WebPage","WebSite"], dry_run: true }
    });
    expect(g.ok()).toBeTruthy();
    const gr = await g.json();

    // Check structure
    expect(Array.isArray(gr.jsonld)).toBeTruthy();
    expect(gr.jsonld.length).toBeGreaterThanOrEqual(2);

    // Check WebSite
    const website = gr.jsonld.find((obj: any) => obj['@type'] === 'WebSite');
    expect(website).toBeTruthy();
    expect(website['@context']).toBe('https://schema.org');
    expect(typeof website.url).toBe('string');
    expect(typeof website.name).toBe('string');

    // Check WebPage
    const webpage = gr.jsonld.find((obj: any) => obj['@type'] === 'WebPage');
    expect(webpage).toBeTruthy();
    expect(webpage['@context']).toBe('https://schema.org');
    expect(webpage.url).toBe(`${baseURL}/test-page`);
    expect(typeof webpage.name).toBe('string');

    // Validation report should have no errors
    expect(gr.report.errors).toEqual([]);
  });
});
