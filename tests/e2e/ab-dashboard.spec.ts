import { test, expect } from "@playwright/test";

test.describe("AB Analytics Dashboard @dev-only", () => {
  test.beforeEach(async ({ page }) => {
    // Enable dev mode (set cookie or query param depending on your implementation)
    await page.addInitScript(() => {
      localStorage.setItem("dev-mode-enabled", "true");
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("renders AB analytics dashboard in admin dock", async ({ page }) => {
    // Look for the dashboard heading
    const heading = page.locator("text=A/B Test Analytics");
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Check for refresh button
    const refreshBtn = page.locator('button:has-text("Refresh")');
    await expect(refreshBtn).toBeVisible();

    // Check for overall stats cards
    await expect(page.locator("text=Variant A")).toBeVisible();
    await expect(page.locator("text=Variant B")).toBeVisible();
    await expect(page.locator("text=Winner")).toBeVisible();
  });

  test("date filters work correctly", async ({ page }) => {
    // Wait for dashboard to render
    await expect(page.locator("text=A/B Test Analytics")).toBeVisible({
      timeout: 10000,
    });

    // Find date inputs
    const fromDate = page.locator('input[type="date"]').first();
    const toDate = page.locator('input[type="date"]').last();

    // Set date range
    await fromDate.fill("2025-01-01");
    await toDate.fill("2025-01-15");

    // Click apply filter
    const applyBtn = page.locator('button:has-text("Apply Filter")');
    await applyBtn.click();

    // Should show clear button
    const clearBtn = page.locator('button:has-text("Clear")');
    await expect(clearBtn).toBeVisible();

    // Click clear button
    await clearBtn.click();

    // Clear button should disappear
    await expect(clearBtn).not.toBeVisible();
  });

  test("refresh button updates data", async ({ page }) => {
    // Wait for dashboard
    await expect(page.locator("text=A/B Test Analytics")).toBeVisible({
      timeout: 10000,
    });

    // Click refresh button
    const refreshBtn = page.locator('button:has-text("Refresh")').first();
    await refreshBtn.click();

    // Should briefly show "Refreshing..."
    await expect(page.locator('button:has-text("Refreshing")')).toBeVisible({
      timeout: 2000,
    });

    // Then go back to "Refresh"
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible({
      timeout: 5000,
    });
  });

  test("displays chart when data is available", async ({ page }) => {
    // Wait for dashboard
    await expect(page.locator("text=A/B Test Analytics")).toBeVisible({
      timeout: 10000,
    });

    // Look for chart container (Recharts creates SVG)
    const chart = page.locator(".recharts-wrapper");

    // Chart may or may not be present depending on data
    // Just check that either chart OR "No data" message is present
    const hasChart = await chart.isVisible().catch(() => false);
    const noDataMsg = await page
      .locator("text=No data in selected date range")
      .isVisible()
      .catch(() => false);

    expect(hasChart || noDataMsg).toBeTruthy();
  });
});
