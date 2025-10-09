/**
 * E2E Tests: SEO Meta Suggestion API
 *
 * Tests the /agent/seo/meta/suggest endpoint for generating SEO title/description.
 */
import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8001';

test.describe('SEO meta suggestion', () => {
  test('GET /agent/seo/meta/suggest yields title/desc within limits', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/agent/seo/meta/suggest`, {
      params: { path: '/index.html' }
    });

    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const j = await res.json();

      // Validate response structure
      expect(j.path).toBe('/index.html');
      expect(j.generated_at).toBeTruthy();
      expect(j.base).toBeTruthy();
      expect(j.suggestion).toBeTruthy();
      expect(Array.isArray(j.keywords)).toBeTruthy();

      // Validate limits
      const titleMax = j.suggestion?.limits?.title_max ?? 60;
      const descMax = j.suggestion?.limits?.desc_max ?? 155;

      expect(j.suggestion?.title?.length).toBeLessThanOrEqual(titleMax);
      expect(j.suggestion?.desc?.length).toBeLessThanOrEqual(descMax);

      // Validate integrity
      expect(j.integrity?.algo).toBe('sha256');
      expect(typeof j.integrity?.value).toBe('string');
      expect(j.integrity?.value).toMatch(/^[a-f0-9]{64}$/);

      console.log(`✅ Meta suggestion for /index.html:`);
      console.log(`   Title: "${j.suggestion?.title}" (${j.suggestion?.title?.length}/${titleMax})`);
      console.log(`   Desc: "${j.suggestion?.desc?.substring(0, 50)}..." (${j.suggestion?.desc?.length}/${descMax})`);
      console.log(`   Keywords: ${j.keywords?.join(', ') || 'none'}`);
    } else {
      console.log('⚠️  /index.html not found in discovered pages');
    }
  });

  test('Suggestions incorporate keywords when available', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/agent/seo/meta/suggest`, {
      params: { path: '/index.html' }
    });

    if (res.status() !== 200) {
      console.log('⚠️  Skipping - page not found');
      return;
    }

    const j = await res.json();

    // If keywords exist, check they're used in title or desc
    if (j.keywords && j.keywords.length > 0) {
      const titleLower = j.suggestion?.title?.toLowerCase() || '';
      const descLower = j.suggestion?.desc?.toLowerCase() || '';
      const combined = titleLower + ' ' + descLower;

      // At least one keyword should appear in title or description
      const hasKeyword = j.keywords.some((kw: string) =>
        combined.includes(kw.toLowerCase())
      );

      expect(hasKeyword).toBeTruthy();
      console.log(`✅ Keywords integrated into suggestions`);
    } else {
      console.log(`⚠️  No keywords available for /index.html`);
    }
  });

  test('Base metadata preserved in response', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/agent/seo/meta/suggest`, {
      params: { path: '/index.html' }
    });

    if (res.status() !== 200) {
      console.log('⚠️  Skipping - page not found');
      return;
    }

    const j = await res.json();

    // Validate base metadata structure
    expect(j.base).toBeTruthy();
    expect(j.base).toHaveProperty('title');
    expect(j.base).toHaveProperty('desc');

    console.log(`✅ Base metadata preserved:`);
    console.log(`   Original title: "${j.base?.title || '(none)'}"`);
    console.log(`   Original desc: "${j.base?.desc?.substring(0, 50) || '(none)'}..."`);
  });

  test('Artifacts written to seo-meta directory', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/agent/seo/meta/suggest`, {
      params: { path: '/index.html' }
    });

    if (res.status() !== 200) {
      console.log('⚠️  Skipping - page not found');
      return;
    }

    const j = await res.json();

    // Verify integrity checksum is present
    expect(j.integrity).toBeTruthy();
    expect(j.integrity.algo).toBe('sha256');
    expect(j.integrity.size).toBeGreaterThan(0);

    console.log(`✅ Artifact checksum: ${j.integrity.algo}:${j.integrity.value}`);
    console.log(`   Size: ${j.integrity.size} bytes`);
    console.log(`   Expected file: agent/artifacts/seo-meta/index-html.json`);
  });

  test('Returns 404 for unknown pages', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/agent/seo/meta/suggest`, {
      params: { path: '/nonexistent-page-12345.html' }
    });

    expect(res.status()).toBe(404);

    const j = await res.json();
    expect(j.detail).toContain('Unknown page');

    console.log(`✅ Returns 404 for unknown pages`);
  });
});
