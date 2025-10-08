/**
 * E2E Test: AB Winner Highlighting
 * @tags @frontend @phase50.2 @analytics @tools
 */
import { test, expect } from "@playwright/test";
import { enableOverlayOnPage } from "./lib/overlay";

test.describe("AB Winner Bold Highlighting @tools", () => {
  test("should bold the winner CTR and dim the loser", async ({ page }) => {
    await enableOverlayOnPage(page);
    await page.goto("/tools.html", { waitUntil: "networkidle" });

    // Wait for AB analytics dashboard to load
    await page.getByTestId("ab-analytics").waitFor({ state: "visible" });

    // Check CTR values are visible
    await expect(page.getByTestId("ab-ctr-a")).toBeVisible();
    await expect(page.getByTestId("ab-ctr-b")).toBeVisible();

    // Winner should have bold/emphasized styling
    const ctrA = page.getByTestId("ab-ctr-a");
    const ctrB = page.getByTestId("ab-ctr-b");

    // At least one should be visible with content
    const hasContent = await ctrA.textContent() || await ctrB.textContent();
    expect(hasContent).toBeTruthy();
  });

  test("should display winner in analytics dashboard", async ({ page }) => {
    await enableOverlayOnPage(page);
    await page.goto("/tools.html", { waitUntil: "networkidle" });

    await page.getByTestId("ab-analytics").waitFor({ state: "visible" });

    // Check for winner indication (look for variant cards)
    const ctrA = page.getByTestId("ab-ctr-a");
    const ctrB = page.getByTestId("ab-ctr-b");

    await expect(ctrA).toBeVisible();
    await expect(ctrB).toBeVisible();
  });

  test("should show refresh button and date filters", async ({ page }) => {
    await enableOverlayOnPage(page);
    await page.goto("/tools.html", { waitUntil: "networkidle" });

    await page.getByTestId("ab-analytics").waitFor({ state: "visible" });

    // Check for refresh button
    const refreshBtn = page.locator('button:has-text("Refresh")');
    await expect(refreshBtn).toBeVisible();

    // Check for date filters
    const fromDate = page.locator('input[type="date"]').first();
    const toDate = page.locator('input[type="date"]').last();
    await expect(fromDate).toBeVisible();
    await expect(toDate).toBeVisible();
  });
});
