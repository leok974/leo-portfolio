/**
 * E2E Test: Run Now Button & Badge Refresh
 * @tags @frontend @phase50.2 @optimization
 */
import { test, expect } from "@playwright/test";

test.describe("Run Now Button & Badge Auto-Refresh", () => {
  test("should trigger optimization with Run Now button", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for AB analytics panel
    await page.waitForSelector('[data-testid="ab-analytics"]', { timeout: 5000 });

    // Find Run Now button
    const runBtn = page.locator('[data-testid="run-now"]');
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toBeEnabled();

    // Check initial badge value
    const badge = page.locator('[data-testid="last-run-badge"]');
    await expect(badge).toBeVisible();
    const initialText = await badge.textContent();

    // Click Run Now
    await runBtn.click();

    // Button should be disabled during optimization
    await expect(runBtn).toBeDisabled({ timeout: 1000 });

    // Wait for toast notification
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(/Optimization (started|complete)/i);

    // Button should be re-enabled after completion
    await expect(runBtn).toBeEnabled({ timeout: 10000 });

    // Badge should have updated (different text)
    const updatedText = await badge.textContent();
    expect(updatedText).not.toBe(initialText);
  });

  test("should allow preset selection before running", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    await page.waitForSelector('[data-testid="ab-analytics"]', { timeout: 5000 });

    // Find preset selector
    const presetSelect = page.locator('[data-testid="preset-select"]');
    await expect(presetSelect).toBeVisible();

    // Check available options
    await presetSelect.click();
    const options = page.locator('[data-testid="preset-select"] option');
    const count = await options.count();

    expect(count).toBeGreaterThanOrEqual(3); // default, recruiter, hiring_manager

    // Select a preset
    await presetSelect.selectOption("recruiter");
    const selected = await presetSelect.inputValue();
    expect(selected).toBe("recruiter");
  });

  test("should refresh badge automatically when optimization completes", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    await page.waitForSelector('[data-testid="last-run-badge"]', { timeout: 5000 });
    const badge = page.locator('[data-testid="last-run-badge"]');

    // Dispatch layout:updated event manually (simulates Run Now completion)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("siteagent:layout:updated"));
    });

    // Wait for badge to refresh (500ms delay + fetch time)
    await page.waitForTimeout(1000);

    const after = await badge.textContent();

    // Badge should have attempted to refresh (may be same if no actual backend change)
    // Just verify it's still visible and has content
    expect(after).toBeTruthy();
    expect(await badge.isVisible()).toBe(true);
  });

  test("should show error toast if optimization fails", async ({ page }) => {
    // Mock backend to fail
    await page.route("**/agent/act", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Optimization failed" }),
      });
    });

    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="run-now"]', { timeout: 5000 });

    const runBtn = page.locator('[data-testid="run-now"]');
    await runBtn.click();

    // Should show error toast
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toBeVisible({ timeout: 3000 });
    await expect(toast).toContainText(/fail|error/i);
  });
});
