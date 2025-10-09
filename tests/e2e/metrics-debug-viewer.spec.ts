import { test, expect, Page } from "@playwright/test";

// Helper: enable privileged UI and set a dev token before the page loads
async function enablePrivileged(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("dev:unlock", "1");          // typical guard flag
      localStorage.setItem("dev:token", "e2e-token");   // used by fetch auth
    } catch {}
  });
}

test.describe("Privileged Metrics · Debug Status viewer", () => {
  test("renders, loads JSON, refresh updates, copy shows toast", async ({ page }) => {
    const base = process.env.BASE_URL || "http://localhost:5173";

    // Stub the guarded API with two different payloads to verify refresh
    let hit = 0;
    await page.route("**/agent/metrics/debug", async (route) => {
      hit++;
      const body =
        hit === 1
          ? {
              settings: {
                ANALYTICS_DIR: "./data/analytics",
                ANALYTICS_RETENTION_DAYS: 90,
                ANALYTICS_GZIP_AFTER_DAYS: 7,
                LOG_IP_ENABLED: true,
                GEOIP_DB_PATH_set: true,
                GEOIP_DB_EXISTS: true,
                METRICS_ALLOW_LOCALHOST: true,
                LEARNING_EPSILON: 0.1,
                LEARNING_DECAY: 0.98,
                LEARNING_EMA_ALPHA: 0.3,
              },
              analytics: { dir_exists: true, file_count: 12, latest_files: ["events-20250101.jsonl.gz"] },
              time: "2025-10-09T12:00:00Z",
              pid: 12345,
            }
          : {
              settings: {
                ANALYTICS_DIR: "./data/analytics",
                ANALYTICS_RETENTION_DAYS: 90,
                ANALYTICS_GZIP_AFTER_DAYS: 7,
                LOG_IP_ENABLED: true,
                GEOIP_DB_PATH_set: true,
                GEOIP_DB_EXISTS: true,
                METRICS_ALLOW_LOCALHOST: true,
                LEARNING_EPSILON: 0.1,
                LEARNING_DECAY: 0.98,
                LEARNING_EMA_ALPHA: 0.3,
              },
              analytics: { dir_exists: true, file_count: 34, latest_files: ["events-20250102.jsonl.gz"] },
              time: "2025-10-09T12:01:00Z",
              pid: 12346,
            };
      await route.fulfill({
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify(body),
      });
    });

    await enablePrivileged(page);
    await page.goto(base, { waitUntil: "domcontentloaded" });

    // The Debug Status panel should be present
    const panel = page.getByText("Debug Status", { exact: true });
    await expect(panel).toBeVisible();

    // Pretty-printed JSON should include "analytics" and first file_count (12)
    const pre = page.locator("pre");
    await expect(pre).toContainText('"analytics"');
    await expect(pre).toContainText('"file_count": 12');

    // Click Refresh -> fetch #2 -> file_count should change to 34
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(pre).toContainText('"file_count": 34');

    // Copy JSON should show a toast ("Copied debug JSON")
    await page.getByRole("button", { name: "Copy JSON" }).click();
    await expect(page.getByText("Copied debug JSON")).toBeVisible();
  });

  test("shows error state when backend replies 401", async ({ page }) => {
    const base = process.env.BASE_URL || "http://localhost:5173";

    // This time, don't set a token; also stub the API to return 401
    await page.route("**/agent/metrics/debug", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "dev_token_required" }),
      });
    });

    // Only unlock (UI), do NOT set dev:token
    await page.addInitScript(() => {
      try { localStorage.setItem("dev:unlock", "1"); } catch {}
    });
    await page.goto(base, { waitUntil: "domcontentloaded" });

    // Panel header should exist
    await expect(page.getByText("Debug Status", { exact: true })).toBeVisible();
    // Error text should be shown in the panel
    await expect(page.getByText(/dev_token_required|HTTP 401/i)).toBeVisible();
  });
});
