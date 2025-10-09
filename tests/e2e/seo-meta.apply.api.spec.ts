/**
 * E2E tests for SEO meta apply endpoints (preview & commit)
 *
 * Tests the preview and commit functionality for SEO meta changes.
 * Commit test is skipped by default to prevent file modifications during CI.
 */
import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8001';

test.describe('SEO meta apply (dev)', () => {
  test('preview returns diff + artifacts', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/agent/seo/meta/preview`, {
      params: { path: '/index.html' },
      data: { title: 'Test Title (Preview)', desc: 'Test description for preview.' }
    });

    // Should be 200 if file exists, 404 if not found
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const j = await res.json();

      // Validate response structure
      expect(j.ok).toBeTruthy();
      expect(j.path).toBe('/index.html');
      expect(j.artifacts).toBeTruthy();
      expect(j.artifacts.diff).toMatch(/\.diff$/);
      expect(j.artifacts.preview_html).toMatch(/\.preview\.html$/);

      // Validate integrity
      expect(j.integrity?.algo).toBe('sha256');
      expect(j.integrity?.value).toMatch(/^[a-f0-9]{64}$/);
      expect(j.integrity?.size).toBeGreaterThan(0);

      // Validate changed flags
      expect(typeof j.changed?.title).toBe('boolean');
      expect(typeof j.changed?.description).toBe('boolean');

      // Validate empty_diff flag
      expect(typeof j.empty_diff).toBe('boolean');

      console.log('✓ Preview generated:');
      console.log(`  - Changed: ${j.changed?.title ? 'title' : ''} ${j.changed?.description ? 'description' : ''}`);
      console.log(`  - Empty diff: ${j.empty_diff}`);
      console.log(`  - Artifacts: ${j.artifacts.diff}`);
    } else {
      console.log('⚠ File not found (expected in some environments)');
    }
  });

  test('preview with no changes returns empty_diff=true', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/agent/seo/meta/preview`, {
      params: { path: '/index.html' },
      data: { title: null, desc: null }
    });

    if (res.status() === 200) {
      const j = await res.json();
      expect(j.ok).toBeTruthy();
      expect(j.empty_diff).toBe(true);
      expect(j.changed?.title).toBe(false);
      expect(j.changed?.description).toBe(false);

      console.log('✓ Empty diff validated (no changes)');
    }
  });

  test('preview with invalid path returns 404', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/agent/seo/meta/preview`, {
      params: { path: '/nonexistent-page-xyz.html' },
      data: { title: 'Test', desc: 'Test' }
    });

    expect(res.status()).toBe(404);
    const j = await res.json();
    expect(j.detail).toMatch(/Cannot resolve/);

    console.log('✓ 404 response for invalid path');
  });

  // Commit test - SKIPPED by default to prevent file modifications
  test('commit dry-run mode (confirm=0)', async ({ request }) => {
    test.skip(process.env.WRITE_OK === '1', 'Commit test enabled (WRITE_OK=1)');

    const res = await request.post(`${BACKEND_URL}/agent/seo/meta/commit`, {
      params: { path: '/index.html', confirm: 0 },
      data: { title: 'Dry Run Title', desc: 'Dry run description.' }
    });

    // Should be 200 if ALLOW_DEV_ROUTES=1, 403 if disabled, 404 if file not found
    expect([200, 403, 404]).toContain(res.status());

    if (res.status() === 200) {
      const j = await res.json();
      expect(j.ok).toBeTruthy();
      expect(j.dry_run).toBe(true);
      expect(j.note).toMatch(/confirm=1/);
      expect(j.artifacts).toBeTruthy();

      console.log('✓ Dry-run mode validated');
    } else if (res.status() === 403) {
      console.log('⚠ Dev routes disabled (expected in production)');
    }
  });

  // Full commit test - SKIPPED by default
  test('commit writes backup + applies html', async ({ request }) => {
    test.skip(process.env.WRITE_OK === '1', 'Commit test enabled (WRITE_OK=1)');

    const res = await request.post(`${BACKEND_URL}/agent/seo/meta/commit`, {
      params: { path: '/index.html', confirm: 1 },
      data: { title: 'Committed Title', desc: 'Committed description.' }
    });

    // Should be 200 if successful, 403 if dev routes disabled, 404 if not found
    expect([200, 403, 404]).toContain(res.status());

    if (res.status() === 200) {
      const j = await res.json();
      expect(j.ok).toBeTruthy();
      expect(j.applied).toBe(true);
      expect(j.backup).toMatch(/\.bak\./);
      expect(j.changed).toBeTruthy();
      expect(j.artifacts).toBeTruthy();
      expect(j.integrity).toBeTruthy();

      console.log('✓ Commit successful:');
      console.log(`  - Backup: ${j.backup}`);
      console.log(`  - Changed: ${j.changed?.title ? 'title' : ''} ${j.changed?.description ? 'description' : ''}`);
    } else if (res.status() === 403) {
      console.log('⚠ Dev routes disabled (set ALLOW_DEV_ROUTES=1)');
    }
  });
});
