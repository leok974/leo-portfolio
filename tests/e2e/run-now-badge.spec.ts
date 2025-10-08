/**
 * E2E Test: Run Now Button & Badge Refresh
 * @tags @frontend @phase50.2 @optimization @tools
 */
import { test, expect } from "@playwright/test";
import { API_URL } from "./lib/api";

test.describe("Run Now Button & Badge Auto-Refresh @tools", () => {
  test.beforeEach(async ({ request }) => {
    // Enable dev overlay before each test
    await request.post(`${API_URL}/agent/dev/enable`);
  });

  test("should show autotune button in tools panel", async ({ page }) => {
    await page.goto("/tools.html", { waitUntil: "networkidle" });

    // Wait for tools page to load
    await page.waitForSelector("text=Site Agent Tools", { timeout: 10000 });

    // Find autotune button
    const autotuneBtn = page.locator('button:has-text("Run Autotune")');
    await expect(autotuneBtn).toBeVisible();
    await expect(autotuneBtn).toBeEnabled();
  });

  test("should trigger autotune and show feedback", async ({ page }) => {
    await page.goto("/tools.html", { waitUntil: "networkidle" });

    await page.waitForSelector("text=Site Agent Tools", { timeout: 10000 });

    // Find autotune button
    const autotuneBtn = page.locator('button:has-text("Run Autotune")');
    await expect(autotuneBtn).toBeVisible();

    // Click autotune
    await autotuneBtn.click();

    // Button should show loading state
    await expect(page.locator('button:has-text("Running Autotune")')).toBeVisible({
      timeout: 2000,
    });

    // Wait for completion (success or error message)
    const successMsg = page.locator("text=✅");
    const errorMsg = page.locator("text=❌");

    // One of them should appear within 15 seconds
    await expect(successMsg.or(errorMsg)).toBeVisible({ timeout: 15000 });
  });

  test("should show learning rate in autotune section", async ({ page }) => {
    await page.goto("/tools.html", { waitUntil: "networkidle" });

    await page.waitForSelector("text=Site Agent Tools", { timeout: 10000 });

    // Check for learning rate display
    const alphaText = page.locator("text=Learning rate (alpha)");
    await expect(alphaText).toBeVisible();
  });
});
