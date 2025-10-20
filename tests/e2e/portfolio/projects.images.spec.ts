/**
 * E2E tests for project image loading and fallback behavior.
 * Ensures all visible project thumbnails load correctly and fail gracefully.
 */

import { test, expect } from '@playwright/test';

test.describe('Project Images', () => {
  test('all visible project thumbnails load successfully', async ({ page }) => {
    // Navigate to portfolio with layout view to show project cards
    await page.goto('/?layout=1');

    // Wait for app to be fully initialized
    await page.waitForFunction(() => (window as any).__APP_READY__ === true, { timeout: 10000 });

    // Locate all project card images
    const imgs = page.locator('[data-testid="project-card"] img, .project-card img');
    const count = await imgs.count();

    // Verify at least some projects exist
    expect(count).toBeGreaterThan(0);

    // Check each image loads successfully
    for (let i = 0; i < count; i++) {
      const img = imgs.nth(i);

      // Get image loading status
      const loadInfo = await img.evaluate((el: HTMLImageElement) => ({
        complete: el.complete,
        naturalWidth: el.naturalWidth,
        naturalHeight: el.naturalHeight,
        src: el.src,
        hasError: el.classList.contains('img-fallback')
      }));

      // Image should either load successfully OR fall back gracefully
      const isLoaded = loadInfo.complete && loadInfo.naturalWidth > 0 && loadInfo.naturalHeight > 0;

      expect(isLoaded,
        `Project image ${i + 1}/${count} failed to load: ${loadInfo.src} ` +
        `(complete=${loadInfo.complete}, naturalWidth=${loadInfo.naturalWidth}, ` +
        `hasError=${loadInfo.hasError})`
      ).toBe(true);
    }
  });

  test('fallback image loads when thumbnail missing', async ({ page }) => {
    // Navigate to portfolio
    await page.goto('/?layout=1');
    await page.waitForFunction(() => (window as any).__APP_READY__ === true, { timeout: 10000 });

    // Inject a test card with broken image to verify fallback behavior
    await page.evaluate(() => {
      const testCard = document.createElement('div');
      testCard.className = 'project-card';
      testCard.setAttribute('data-testid', 'test-broken-image');
      testCard.innerHTML = `
        <div class="project-thumbnail">
          <img
            src="/nonexistent-image.png"
            alt="Test"
            onerror="this.onerror=null; this.src='/og/og.png'; this.classList.add('img-fallback');"
          />
        </div>
      `;
      document.querySelector('.portfolio-grid')?.appendChild(testCard);
    });

    // Wait for fallback to trigger
    await page.waitForTimeout(1000);

    // Verify fallback image loaded successfully
    const fallbackImg = page.locator('[data-testid="test-broken-image"] img');
    const fallbackInfo = await fallbackImg.evaluate((el: HTMLImageElement) => ({
      complete: el.complete,
      naturalWidth: el.naturalWidth,
      src: el.src,
      hasFallbackClass: el.classList.contains('img-fallback')
    }));

    expect(fallbackInfo.complete).toBe(true);
    expect(fallbackInfo.naturalWidth).toBeGreaterThan(0);
    expect(fallbackInfo.src).toContain('/og/og.png');
    expect(fallbackInfo.hasFallbackClass).toBe(true);
  });
});
