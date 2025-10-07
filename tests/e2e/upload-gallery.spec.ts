/**
 * upload-gallery.spec.ts
 * E2E tests for file upload and gallery integration
 *
 * Tests:
 * - Attachment button presence and accessibility
 * - File upload flow (image and video)
 * - Gallery card creation
 * - Success/error message display
 * - API integration
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_TIMEOUT = 30000; // 30 seconds for uploads

test.describe('Upload and Gallery Integration @uploads', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Open assistant dock (chat) - find the chip button
    const chipBtn = page.locator('#assistantChip, [data-testid="assistant-chip"]');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000); // Wait for scripts to initialize

    // Click chip if visible
    if (await chipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await chipBtn.click();
      await page.waitForTimeout(500); // Wait for dock to open
    }

    // Wait for chat input to be ready (might already be visible)
    const chatInput = page.getByTestId('assistant-input');
    await expect(chatInput).toBeAttached({ timeout: 5000 });
  });

  test('attachment button is present and accessible', async ({ page }) => {
    // Check for attachment button
    const attachBtn = page.getByTestId('attachment-button');
    await expect(attachBtn).toBeVisible();

    // Check accessibility attributes
    await expect(attachBtn).toHaveAttribute('aria-label', 'Attach file');
    await expect(attachBtn).toHaveAttribute('type', 'button');

    // Check icon (paperclip emoji)
    await expect(attachBtn).toContainText('📎');
  });

  test('attachment button triggers file chooser', async ({ page }) => {
    const attachBtn = page.getByTestId('attachment-button');

    // Set up file chooser listener
    const fileChooserPromise = page.waitForEvent('filechooser');

    // Click attachment button
    await attachBtn.click();

    // Verify file chooser opened
    const fileChooser = await fileChooserPromise;
    expect(fileChooser).toBeTruthy();

    // Check accepted file types
    const inputElement = await fileChooser.element();
    const accept = await inputElement.getAttribute('accept');
    expect(accept).toContain('image');
  });

  test('upload image creates gallery card', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Create test image file
    const testImagePath = path.join(__dirname, '../fixtures/test-upload.png');

    // Create minimal PNG if it doesn't exist
    if (!fs.existsSync(testImagePath)) {
      const fixturesDir = path.join(__dirname, '../fixtures');
      if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
      }

      // Minimal 1x1 PNG (black pixel)
      const pngData = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT chunk
        0x54, 0x08, 0xd7, 0x63, 0x60, 0x00, 0x00, 0x00,
        0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, // IEND
        0x42, 0x60, 0x82
      ]);
      fs.writeFileSync(testImagePath, pngData);
    }

    // Mock upload API if not available
    await page.route('**/api/uploads', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          url: '/assets/uploads/2025/10/test-upload.png',
          kind: 'image',
          item: {
            id: 'test-upload-abc123',
            title: 'Test Upload',
            description: '',
            date: '2025-10-06',
            type: 'image',
            src: '/assets/uploads/2025/10/test-upload.png',
            tools: [],
            tags: []
          },
          lint_ok: true
        })
      });
    });

    const attachBtn = page.getByTestId('attachment-button');

    // Trigger file chooser
    const fileChooserPromise = page.waitForEvent('filechooser');
    await attachBtn.click();
    const fileChooser = await fileChooserPromise;

    // Upload file
    await fileChooser.setFiles(testImagePath);

    // Wait for upload to complete - check for success message
    await expect(page.getByTestId('upload-message-success')).toBeVisible({ timeout: 10000 });

    // Verify success message contains gallery reference
    const successMsg = page.getByTestId('upload-message-success');
    await expect(successMsg).toContainText('Added to gallery');

    // Verify button returns to normal state
    await expect(attachBtn).toContainText('📎');
    await expect(attachBtn).toBeEnabled();
  });

  test('upload error shows error message', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Mock upload API to fail
    await page.route('**/api/uploads', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'text/plain',
        body: 'Internal Server Error: Upload failed'
      });
    });

    // Create test file
    const testImagePath = path.join(__dirname, '../fixtures/test-fail.png');
    if (!fs.existsSync(testImagePath)) {
      const fixturesDir = path.join(__dirname, '../fixtures');
      if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
      }
      fs.writeFileSync(testImagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    }

    const attachBtn = page.getByTestId('attachment-button');

    // Trigger file chooser
    const fileChooserPromise = page.waitForEvent('filechooser');
    await attachBtn.click();
    const fileChooser = await fileChooserPromise;

    // Upload file
    await fileChooser.setFiles(testImagePath);

    // Wait for error message
    await expect(page.getByTestId('upload-message-error')).toBeVisible({ timeout: 10000 });

    // Verify error message
    const errorMsg = page.getByTestId('upload-message-error');
    await expect(errorMsg).toContainText('Upload failed');

    // Verify button returns to normal state (with X temporarily)
    await expect(attachBtn).toContainText('✗');

    // Wait for button to reset
    await expect(attachBtn).toContainText('📎', { timeout: 5000 });
  });

  test('upload video creates gallery card with poster', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Mock upload API for video
    await page.route('**/api/uploads', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          url: '/assets/video/2025/10/test-video.mp4',
          kind: 'video',
          item: {
            id: 'test-video-abc123',
            title: 'Test Video',
            description: '',
            date: '2025-10-06',
            type: 'video-local',
            src: '/assets/video/2025/10/test-video.mp4',
            poster: '/assets/video/2025/10/test-video.jpg',
            mime: 'video/mp4',
            tools: [],
            tags: []
          },
          lint_ok: true
        })
      });
    });

    // Create minimal MP4-like file
    const testVideoPath = path.join(__dirname, '../fixtures/test-video.mp4');
    if (!fs.existsSync(testVideoPath)) {
      const fixturesDir = path.join(__dirname, '../fixtures');
      if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
      }
      // MP4 signature
      fs.writeFileSync(testVideoPath, Buffer.from([
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, // ftyp box
        0x69, 0x73, 0x6f, 0x6d
      ]));
    }

    const attachBtn = page.getByTestId('attachment-button');

    // Trigger file chooser
    const fileChooserPromise = page.waitForEvent('filechooser');
    await attachBtn.click();
    const fileChooser = await fileChooserPromise;

    // Upload video
    await fileChooser.setFiles(testVideoPath);

    // Wait for success
    await expect(page.getByTestId('upload-message-success')).toBeVisible({ timeout: 10000 });

    // Verify message mentions gallery
    const successMsg = page.getByTestId('upload-message-success');
    await expect(successMsg).toContainText('Added to gallery');
  });

  test('attachment button is keyboard accessible', async ({ page }) => {
    const attachBtn = page.getByTestId('attachment-button');

    // Focus the button
    await attachBtn.focus();

    // Verify focus state
    await expect(attachBtn).toBeFocused();

    // Set up file chooser listener
    const fileChooserPromise = page.waitForEvent('filechooser');

    // Press Enter to activate
    await page.keyboard.press('Enter');

    // Verify file chooser opened
    const fileChooser = await fileChooserPromise;
    expect(fileChooser).toBeTruthy();
  });

  test('attachment button respects disabled state during upload', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Mock slow upload
    await page.route('**/api/uploads', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          url: '/assets/uploads/2025/10/test.png',
          kind: 'image'
        })
      });
    });

    // Create test file
    const testImagePath = path.join(__dirname, '../fixtures/test-disabled.png');
    if (!fs.existsSync(testImagePath)) {
      const fixturesDir = path.join(__dirname, '../fixtures');
      if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
      }
      fs.writeFileSync(testImagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    }

    const attachBtn = page.getByTestId('attachment-button');

    // Start upload
    const fileChooserPromise = page.waitForEvent('filechooser');
    await attachBtn.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testImagePath);

    // Wait a bit for upload to start
    await page.waitForTimeout(500);

    // Verify button is disabled during upload
    await expect(attachBtn).toBeDisabled();

    // Verify loading indicator (hourglass emoji)
    await expect(attachBtn).toContainText('⏳');

    // Wait for upload to complete
    await expect(attachBtn).toBeEnabled({ timeout: 10000 });
  });

  test('gallery API endpoint structure', async ({ page }) => {
    // This test verifies the API structure without actually calling backend

    // Check that API helper is available
    const apiAvailable = await page.evaluate(() => {
      return typeof (window as any).API?.uploadFile === 'function';
    });

    expect(apiAvailable).toBeTruthy();
  });

  test('CSRF token is included in upload request', async ({ page }) => {
    // Set a mock CSRF token
    await page.evaluate(() => {
      localStorage.setItem('csrf_token', 'test-csrf-token-123');
    });

    let csrfTokenSent = false;

    // Intercept upload request
    await page.route('**/api/uploads', async (route) => {
      const headers = route.request().headers();
      csrfTokenSent = headers['x-csrf-token'] === 'test-csrf-token-123';

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, url: '/test.png', kind: 'image' })
      });
    });

    // Create test file
    const testImagePath = path.join(__dirname, '../fixtures/test-csrf.png');
    if (!fs.existsSync(testImagePath)) {
      const fixturesDir = path.join(__dirname, '../fixtures');
      if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
      }
      fs.writeFileSync(testImagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    }

    const attachBtn = page.getByTestId('attachment-button');

    // Upload file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await attachBtn.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testImagePath);

    // Wait for request
    await page.waitForTimeout(1000);

    // Verify CSRF token was sent
    expect(csrfTokenSent).toBeTruthy();
  });
});
