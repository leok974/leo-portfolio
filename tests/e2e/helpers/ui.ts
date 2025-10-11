import { Page, Locator, expect } from "@playwright/test";

/**
 * Click a locator reliably by ensuring it's visible, enabled, and in viewport.
 * Includes trial click to warm up layout before actual click.
 */
export async function clickStable(loc: Locator) {
  await loc.scrollIntoViewIfNeeded();
  await expect(loc).toBeVisible();
  await expect(loc).toBeEnabled();
  await loc.click({ trial: true }).catch(() => {}); // warm up layout
  await loc.click();
}

/**
 * Wait for a panel/section to be ready by its heading text.
 */
export async function waitPanel(page: Page, title: string) {
  await page.waitForSelector(`text=${title}`);
}
