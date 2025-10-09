/**
 * E2E Test: AB Toast Notifications
 * @tags @frontend @phase50.2 @toast @public
 */
import { test, expect } from "@playwright/test";

test.describe("AB Toast System (Public Site)", () => {
  test("should display toast notification on project card click", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for page to be interactive
    await page.waitForSelector('.card-click', { timeout: 5000 });

    // Prevent navigation once so toast can appear (navigation hides it instantly)
    await page.evaluate(() => {
      const card = document.querySelector('.card-click');
      if (card) {
        card.addEventListener('click', (e) => e.preventDefault(), { once: true });
      }
    });

    // Click first project card
    const card = page.locator('.card-click').first();
    await card.click();

    // Wait for toast to appear (use test ID)
    const toast = page.getByTestId('toast');
    await expect(toast).toBeVisible({ timeout: 3000 });

    // Toast should have some content (may vary based on bucket)
    const toastText = await toast.textContent();
    expect(toastText).toBeTruthy();

    // Toast should auto-dismiss after a few seconds
    await expect(toast).toBeHidden({ timeout: 5000 });
  });

  test("should track visitor ID in localStorage", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait a moment for AB tracking to initialize
    await page.waitForTimeout(1000);

    // Check localStorage for visitor_id
    const visitorId = await page.evaluate(() => localStorage.getItem("visitor_id"));
    expect(visitorId).toBeTruthy();
    expect(visitorId).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
  });

  test("should initialize AB bucket on page load", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for AB tracking to initialize
    await page.waitForTimeout(1000);

    // Check that bucket is stored in localStorage
    const bucket = await page.evaluate(() => localStorage.getItem("ab_bucket"));
    expect(bucket).toMatch(/^(A|B)$/);
  });
});
