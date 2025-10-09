import type { Page } from '@playwright/test';

/**
 * Enable dev overlay cookie through the page's origin (5173)
 * This ensures the cookie is set on the correct domain/port for the frontend
 */
export async function enableOverlayOnPage(page: Page): Promise<void> {
  // Navigate to any page on the 5173 origin to anchor context
  await page.goto('/');

  // Set cookie via fetch through Vite's proxy (/agent/* → backend)
  // This ensures cookie lands on the frontend origin, not backend origin
  await page.evaluate(async () => {
    await fetch('/agent/dev/enable', { method: 'POST' });
  });

  // Small settle to ensure cookie write is visible on next navigation
  await page.waitForTimeout(100);
}
