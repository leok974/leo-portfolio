/**
 * E2E Test Utilities
 * 
 * Helpers for reliable, deterministic test waits
 */

import { Page, expect } from '@playwright/test';

/**
 * Wait for the portfolio app to be fully mounted and stable
 * 
 * This replaces fragile `waitForLoadState('networkidle')` with
 * a deterministic marker that the app sets when it's ready.
 * 
 * @param page - Playwright page instance
 * @param timeout - Max wait time in ms (default: 10s)
 */
export async function waitForAppReady(page: Page, timeout = 10_000) {
  // Wait for the app-ready flag set by main.ts after mount
  await page.waitForFunction(
    () => (window as any).__APP_READY__ === true,
    { timeout }
  );
  
  // Also ensure chat-dock is visible (key UI element always present)
  await expect(page.getByTestId('chat-dock')).toBeVisible({ timeout: 5_000 });
}
