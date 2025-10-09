/**
 * E2E test: SEO Keywords Discovery
 *
 * Verifies that /agent/seo/keywords includes pages from sitemap.xml
 * when the sitemap exists in the workspace.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BE = process.env.BE_URL || 'http://127.0.0.1:8001';

function readSitemapRelPaths(): string[] {
  const roots = ['public/sitemap.xml', 'dist/sitemap.xml', 'sitemap.xml'];

  for (const rel of roots) {
    const p = path.resolve(process.cwd(), rel);
    if (fs.existsSync(p)) {
      const xml = fs.readFileSync(p, 'utf-8');
      const locs = Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g)).map(m => m[1]);
      const rels = locs
        .map(url => url.replace(/^https?:\/\/[^/]+/, ''))
        .map(u => u.startsWith('/') ? u : `/${u}`);
      return Array.from(new Set(rels));
    }
  }

  return [];
}

test.describe('Phase 50.6 — seo-keywords discovery @agent', () => {
  test('POST /agent/seo/keywords returns items that include sitemap pages (if sitemap exists)', async ({ request }) => {
    const expected = readSitemapRelPaths();

    // If no sitemap found, skip this validation (workspace may not have one)
    if (expected.length === 0) {
      test.skip();
      return;
    }

    const res = await request.post(`${BE}/agent/seo/keywords`, {
      headers: { Authorization: 'Bearer dev' }
    });

    expect(res.ok()).toBeTruthy();
    const json = await res.json();

    // Verify response structure
    expect(json).toHaveProperty('items');
    expect(Array.isArray(json.items)).toBeTruthy();

    // Build set of discovered pages
    const got = new Set((json?.items ?? []).map((p: any) => p.page));

    // All sitemap pages should be in the discovered set
    for (const p of expected) {
      expect(got.has(p)).toBeTruthy();
    }

    console.log(`✅ Verified ${expected.length} sitemap pages in discovery (total discovered: ${got.size})`);
  });

  test('discovered pages include metadata (title, desc)', async ({ request }) => {
    const res = await request.post(`${BE}/agent/seo/keywords`, {
      headers: { Authorization: 'Bearer dev' }
    });

    expect(res.ok()).toBeTruthy();
    const json = await res.json();

    // At least one page should have title or desc
    const hasMetadata = json.items.some((item: any) =>
      (item.title && item.title.length > 0) ||
      (item.desc && item.desc.length > 0)
    );

    expect(hasMetadata).toBeTruthy();

    // Log sample for debugging
    const sample = json.items.slice(0, 3);
    console.log('Sample pages:', sample.map((p: any) => ({
      page: p.page,
      title: p.title?.substring(0, 40) || 'none',
      desc: p.desc?.substring(0, 40) || 'none'
    })));
  });
});
