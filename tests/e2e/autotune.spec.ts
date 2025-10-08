import { test, expect } from "@playwright/test";

test.describe("Autotune Button @dev-only", () => {
  test.beforeEach(async ({ page }) => {
    // Enable dev mode
    await page.addInitScript(() => {
      localStorage.setItem("dev-mode-enabled", "true");
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("renders autotune button in admin dock", async ({ page }) => {
    // Look for the autotune button (has emoji)
    const autotuneBtn = page.locator('button:has-text("🤖 Run Autotune")');
    await expect(autotuneBtn).toBeVisible({ timeout: 10000 });

    // Check for learning rate display
    await expect(page.locator("text=Learning rate (alpha)")).toBeVisible();
  });

  test("clicking autotune button triggers request and shows feedback", async ({
    page,
  }) => {
    // Wait for button to appear
    const autotuneBtn = page.locator('button:has-text("🤖 Run Autotune")');
    await expect(autotuneBtn).toBeVisible({ timeout: 10000 });

    // Intercept the autotune API call
    await page.route("**/agent/autotune*", async (route) => {
      // Mock a successful response
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Autotune completed: weights updated",
          new_weights: { hero: 0.3, projects: 0.3, resume: 0.4 },
        }),
      });
    });

    // Click the button
    await autotuneBtn.click();

    // Should show loading state
    await expect(page.locator('button:has-text("Running Autotune")')).toBeVisible({
      timeout: 2000,
    });

    // Should show success message
    await expect(page.locator("text=✅")).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator("text=Autotune completed: weights updated")
    ).toBeVisible();
  });

  test("autotune error handling", async ({ page }) => {
    // Wait for button
    const autotuneBtn = page.locator('button:has-text("🤖 Run Autotune")');
    await expect(autotuneBtn).toBeVisible({ timeout: 10000 });

    // Mock an error response
    await page.route("**/agent/autotune*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "text/plain",
        body: "Internal server error: optimization failed",
      });
    });

    // Click button
    await autotuneBtn.click();

    // Should show error message
    await expect(page.locator("text=❌")).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator("text=Internal server error: optimization failed")
    ).toBeVisible();
  });

  test("autotune dispatches layout update event", async ({ page }) => {
    // Wait for button
    const autotuneBtn = page.locator('button:has-text("🤖 Run Autotune")');
    await expect(autotuneBtn).toBeVisible({ timeout: 10000 });

    // Listen for the custom event
    const eventPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        window.addEventListener(
          "siteagent:layout:updated",
          (e: Event) => {
            resolve((e as CustomEvent).detail);
          },
          { once: true }
        );
      });
    });

    // Mock successful response
    await page.route("**/agent/autotune*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Autotune completed",
          new_weights: { hero: 0.35, projects: 0.35, resume: 0.3 },
        }),
      });
    });

    // Click button
    await autotuneBtn.click();

    // Wait for event
    const eventDetail = await eventPromise;

    // Verify event detail
    expect(eventDetail).toMatchObject({
      source: "autotune",
      weights: { hero: 0.35, projects: 0.35, resume: 0.3 },
    });
  });
});
