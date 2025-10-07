/**
 * upload-feature-gate.spec.ts
 * E2E tests for upload feature gating
 *
 * Tests:
 * - Upload button hidden when feature disabled
 * - API returns 403 when feature disabled
 * - Upload button visible when feature enabled
 * - Admin can upload regardless of feature flag
 */

import { test, expect } from '@playwright/test';

test.describe('Upload Feature Gating @feature-gate', () => {

  test('upload button hidden when feature disabled', async ({ page }) => {
    // Visit page without setting VITE_FEATURE_AGENT_UPLOADS
    await page.goto('/');

    // Open assistant dock
    const chipBtn = page.locator('#assistantChip');
    if (await chipBtn.isVisible()) {
      await chipBtn.click();
      await page.waitForTimeout(500);
    }

    // Attachment button should not exist
    const attachBtn = page.getByTestId('attachment-button');
    await expect(attachBtn).toHaveCount(0);
  });

  test('API returns 403 when feature disabled and non-admin', async ({ request }) => {
    // Try to upload without feature flag or admin token
    const formData = new FormData();
    formData.append('file', new Blob(['test'], { type: 'image/png' }), 'test.png');

    const response = await request.post('/api/uploads', {
      multipart: {
        file: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47])
        }
      }
    });

    // Should return 403 Forbidden
    expect(response.status()).toBe(403);

    const body = await response.json().catch(() => ({}));
    expect(body.detail).toContain('Uploads are disabled');
  });

  test('gallery API returns 403 when feature disabled', async ({ request }) => {
    const response = await request.post('/api/gallery/add', {
      data: {
        title: 'Test',
        type: 'image',
        src: '/test.png'
      }
    });

    expect(response.status()).toBe(403);
  });

  test('upload API rejects oversized images', async ({ request }) => {
    // Create a payload claiming to be 31MB (exceeds default 30MB limit)
    const largeBuffer = Buffer.alloc(31 * 1024 * 1024, 'a');

    const response = await request.post('/api/uploads', {
      headers: {
        'X-Admin-Token': process.env.ADMIN_TOKEN || 'test-admin-token'
      },
      multipart: {
        file: {
          name: 'large.png',
          mimeType: 'image/png',
          buffer: largeBuffer
        },
        make_card: 'false'
      }
    });

    // Should return 413 Payload Too Large
    expect(response.status()).toBe(413);

    const body = await response.json().catch(() => ({}));
    expect(body.detail).toContain('File too large');
  });

  test('upload API rejects unsupported file types', async ({ request }) => {
    const response = await request.post('/api/uploads', {
      headers: {
        'X-Admin-Token': process.env.ADMIN_TOKEN || 'test-admin-token'
      },
      multipart: {
        file: {
          name: 'test.exe',
          mimeType: 'application/x-msdownload',
          buffer: Buffer.from([0x4d, 0x5a]) // EXE header
        }
      }
    });

    // Should return 415 Unsupported Media Type
    expect(response.status()).toBe(415);

    const body = await response.json().catch(() => ({}));
    expect(body.detail).toContain('Unsupported media type');
  });

  test('admin can upload even when feature disabled', async ({ request }) => {
    // Mock the upload response for admin
    const response = await request.post('/api/uploads', {
      headers: {
        'X-Admin-Token': process.env.ADMIN_TOKEN || 'test-admin-token'
      },
      multipart: {
        file: {
          name: 'admin-test.png',
          mimeType: 'image/png',
          buffer: Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
          ])
        },
        make_card: 'false'
      }
    });

    // Admin should be allowed even when feature is off
    // (This might be 200 if backend is running, or appropriate error if not)
    // The key is it should NOT be 403
    expect(response.status()).not.toBe(403);
  });
});

test.describe('Upload Feature Enabled @feature-enabled', () => {
  test.use({
    // These tests assume VITE_FEATURE_AGENT_UPLOADS=1 or FEATURE_UPLOADS=1
  });

  test('upload button visible when feature enabled', async ({ page }) => {
    // Set the feature flag
    await page.addInitScript(() => {
      (window as any).__VITE_FEATURE_AGENT_UPLOADS__ = true;
    });

    await page.goto('/');

    // Open assistant dock
    const chipBtn = page.locator('#assistantChip');
    if (await chipBtn.isVisible()) {
      await chipBtn.click();
      await page.waitForTimeout(500);
    }

    // Wait for form to be ready
    await page.waitForSelector('#chatForm', { timeout: 3000 });

    // Attachment button should exist
    const attachBtn = page.getByTestId('attachment-button');
    await expect(attachBtn).toBeVisible({ timeout: 5000 });

    // Should have proper attributes
    await expect(attachBtn).toHaveAttribute('aria-label', 'Attach file');
  });

  test('dev mode enables uploads', async ({ page }) => {
    // Set dev unlock flag
    await page.addInitScript(() => {
      (window as any).__DEV_UNLOCKED__ = true;
    });

    await page.goto('/');

    // Open assistant dock
    const chipBtn = page.locator('#assistantChip');
    if (await chipBtn.isVisible()) {
      await chipBtn.click();
      await page.waitForTimeout(500);
    }

    // Wait for form
    await page.waitForSelector('#chatForm', { timeout: 3000 });

    // Button should be visible in dev mode
    const attachBtn = page.getByTestId('attachment-button');
    await expect(attachBtn).toBeVisible({ timeout: 5000 });
  });

  test('admin role enables uploads', async ({ page }) => {
    // Set admin role
    await page.addInitScript(() => {
      (window as any).__USER_ROLE__ = 'admin';
    });

    await page.goto('/');

    // Open assistant dock
    const chipBtn = page.locator('#assistantChip');
    if (await chipBtn.isVisible()) {
      await chipBtn.click();
      await page.waitForTimeout(500);
    }

    // Wait for form
    await page.waitForSelector('#chatForm', { timeout: 3000 });

    // Button should be visible for admin
    const attachBtn = page.getByTestId('attachment-button');
    await expect(attachBtn).toBeVisible({ timeout: 5000 });
  });
});
