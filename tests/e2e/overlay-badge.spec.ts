/**
 * E2E test for OverlayApprovalBadge
 *
 * Verifies that the badge displays the correct count of awaiting_approval tasks
 * when mocked API returns data.
 */
import { test, expect } from "@playwright/test";

test("shows awaiting approval badge when API returns items", async ({ page }) => {
  // Mock the paged endpoint to return 2 awaiting_approval items
  await page.route("**/agents/tasks/paged**", async (route) => {
    const url = new URL(route.request().url());
    const status = url.searchParams.get("status");

    // Only mock awaiting_approval requests (for the badge)
    if (status === "awaiting_approval") {
      const json = { items: [{}, {}], next_cursor: null }; // 2 awaiting
      return route.fulfill({ json });
    }

    // Let other requests pass through or return empty
    return route.fulfill({ json: { items: [], next_cursor: null } });
  });

  // Navigate with admin overlay enabled
  await page.goto("/?admin=1");

  // Wait for and verify the badge shows count of 2
  const badge = page.getByTestId("approval-badge");
  await expect(badge).toBeVisible({ timeout: 5000 });
  await expect(badge).toHaveText("2");
  await expect(badge).toHaveAttribute("title", "Awaiting approval today");
});

test("badge shows loading state initially", async ({ page }) => {
  // Mock with delay to catch loading state
  await page.route("**/agents/tasks/paged**", async (route) => {
    const url = new URL(route.request().url());
    const status = url.searchParams.get("status");

    if (status === "awaiting_approval") {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return route.fulfill({ json: { items: [{}], next_cursor: null } });
    }

    return route.fulfill({ json: { items: [], next_cursor: null } });
  });

  await page.goto("/?admin=1");

  // Should show loading state (ellipsis)
  const badge = page.getByTestId("approval-badge");
  await expect(badge).toHaveText("…");
  await expect(badge).toHaveAttribute("title", "Awaiting approval (loading)");

  // Then show actual count
  await expect(badge).toHaveText("1", { timeout: 3000 });
});

test("badge hidden when count is zero", async ({ page }) => {
  // Mock to return no items
  await page.route("**/agents/tasks/paged**", async (route) => {
    return route.fulfill({ json: { items: [], next_cursor: null } });
  });

  await page.goto("/?admin=1");

  // Badge should not be visible when count is 0
  const badge = page.getByTestId("approval-badge");

  // Wait a bit for initial fetch to complete
  await page.waitForTimeout(1000);

  // Badge should be hidden (not in DOM or not visible)
  await expect(badge).not.toBeVisible();
});

test("badge handles pagination correctly", async ({ page }) => {
  await page.route("**/agents/tasks/paged**", async (route) => {
    const url = new URL(route.request().url());
    const status = url.searchParams.get("status");
    const cursor = url.searchParams.get("cursor");

    // Only mock awaiting_approval requests
    if (status === "awaiting_approval") {
      // First page: 3 items + cursor
      if (!cursor) {
        return route.fulfill({
          json: { items: [{}, {}, {}], next_cursor: "page2" }
        });
      }

      // Second page: 2 items, no cursor
      if (cursor === "page2") {
        return route.fulfill({
          json: { items: [{}, {}], next_cursor: null }
        });
      }
    }

    // Default: empty list
    return route.fulfill({ json: { items: [], next_cursor: null } });
  });

  await page.goto("/?admin=1");

  // Badge should show total count across all pages (3 + 2 = 5)
  const badge = page.getByTestId("approval-badge");
  await expect(badge).toBeVisible({ timeout: 5000 });
  await expect(badge).toHaveText("5");
});
