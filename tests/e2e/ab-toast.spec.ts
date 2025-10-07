/**
 * E2E Test: AB Toast Notifications
 * @tags @frontend @phase50.2 @toast
 */
import { test, expect } from "@playwright/test";

test.describe("AB Toast System", () => {
  test("should display toast notification on project card click", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for page to be interactive
    await page.waitForSelector('[data-testid="project-card"]', { timeout: 5000 });

    // Click first project card
    const card = page.locator('[data-testid="project-card"]').first();
    await card.click();

    // Wait for toast to appear
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toBeVisible({ timeout: 3000 });
    await expect(toast).toContainText(/Thanks! Counted your (A|B) click\./);

    // Toast should auto-dismiss after 2 seconds
    await expect(toast).toBeHidden({ timeout: 3000 });
  });

  test("should show correct bucket (A or B) in toast message", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const card = page.locator('[data-testid="project-card"]').first();
    await card.click();

    const toast = page.locator('[data-testid="toast"]');
    const text = await toast.textContent();

    // Should mention either bucket A or B
    expect(text).toMatch(/(Thanks! Counted your (A|B) click\.)/);
  });

  test("should track visitor ID in localStorage", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // Check localStorage for visitor_id
    const visitorId = await page.evaluate(() => localStorage.getItem("visitor_id"));
    expect(visitorId).toBeTruthy();
    expect(visitorId).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
  });
});
