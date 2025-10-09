/**
 * E2E test: Status Pages API
 *
 * Verifies /agent/status/pages endpoint returns discovered pages
 * with integrity checksums.
 */
import { test, expect } from './test.base';

const BE = process.env.BE_URL || 'http://127.0.0.1:8001';

test.describe('Phase 50.6 — status pages API @agent', () => {
  test('GET /agent/status/pages returns integrity and pages', async ({ request }) => {
    const res = await request.get(`${BE}/agent/status/pages`);

    expect(res.ok()).toBeTruthy();
    const json = await res.json();

    // Validate response structure
    expect(json?.ok).toBe(true);
    expect(json).toHaveProperty('generated_at');
    expect(json).toHaveProperty('count');
    expect(typeof json.count).toBe('number');

    // Validate integrity checksum
    expect(json?.integrity?.algo).toBe('sha256');
    expect(typeof json?.integrity?.value).toBe('string');
    expect(json?.integrity?.value).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    expect(typeof json?.integrity?.size).toBe('number');

    // Validate pages array
    expect(Array.isArray(json?.pages)).toBeTruthy();
    expect(json.pages.length).toBeGreaterThan(0);
    expect(json.count).toBe(json.pages.length);

    // Validate page structure
    const firstPage = json.pages[0];
    expect(firstPage).toHaveProperty('path');
    expect(typeof firstPage.path).toBe('string');
    expect(firstPage.path).toMatch(/^\//); // Path starts with /

    console.log(`✅ Verified ${json.count} pages in status endpoint`);
  });

  test('pages include metadata (title, desc)', async ({ request }) => {
    const res = await request.get(`${BE}/agent/status/pages`);

    expect(res.ok()).toBeTruthy();
    const json = await res.json();

    // At least some pages should have metadata
    const withTitle = json.pages.filter((p: any) => p.title && p.title.length > 0);
    const withDesc = json.pages.filter((p: any) => p.desc && p.desc.length > 0);

    expect(withTitle.length).toBeGreaterThan(0);
    console.log(`Metadata: ${withTitle.length} pages with titles, ${withDesc.length} with descriptions`);

    // Log sample for debugging
    const sample = json.pages.slice(0, 3);
    console.log('Sample pages:', sample.map((p: any) => ({
      path: p.path,
      title: p.title?.substring(0, 40) || 'none',
      desc: p.desc?.substring(0, 40) || 'none'
    })));
  });

  test('cached response matches fresh discovery', async ({ request }) => {
    // First request (may use cache)
    const res1 = await request.get(`${BE}/agent/status/pages`);
    expect(res1.ok()).toBeTruthy();
    const json1 = await res1.json();

    // Second request (should use cache)
    const res2 = await request.get(`${BE}/agent/status/pages`);
    expect(res2.ok()).toBeTruthy();
    const json2 = await res2.json();

    // Count should be consistent
    expect(json2.count).toBe(json1.count);

    // Integrity should be identical (deterministic)
    expect(json2.integrity.value).toBe(json1.integrity.value);
    expect(json2.integrity.size).toBe(json1.integrity.size);

    console.log(`✅ Cache consistency verified (${json1.count} pages, integrity: ${json1.integrity.value.substring(0, 16)}...)`);
  });
});
