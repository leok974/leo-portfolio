import { test, expect } from "@playwright/test";
import { clickStable, waitPanel } from "./helpers/ui";

test.describe("Agents quick runs", () => {
  test("can launch seo.validate and see awaiting_approval or succeeded", async ({ page }) => {
    // Open admin page where agents panel is mounted
    await page.goto("/admin");

    // Wait for quick runs panel to load
    await expect(page.getByRole("heading", { name: /Agents — Quick runs/i })).toBeVisible();

    // Wait for approval panel to be ready (stabilizes UI)
    await waitPanel(page, "Agents — Approvals");

    // Click the SEO validate preset button
    const seoButton = page.getByRole("button", { name: /SEO • validate \(site\)/i });
    await expect(seoButton).toBeVisible();
    await clickStable(seoButton);

    // Wait for button to show "Running..." and then return to normal
    await expect(seoButton).toHaveText(/Running…/);
    await expect(seoButton).not.toHaveText(/Running…/, { timeout: 5000 });

    // Verify the backend responded by making a direct API call to check status
    await expect
      .poll(async () => {
        const resp = await page.evaluate(async () => {
          const r = await fetch("/agents/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agent: "seo",
              task: "validate",
              inputs: { pages: "sitemap://current" },
            }),
          });
          return r.ok ? await r.json() : null;
        });
        return resp?.status ?? "nope";
      }, { timeout: 5000 })
      .toMatch(/^(awaiting_approval|succeeded|running|queued)$/);
  });

  test("quick run buttons are disabled while busy", async ({ page }) => {
    await page.goto("/admin");

    // Wait for panels to be ready
    await waitPanel(page, "Agents — Approvals");

    // Find a preset button
    const button = page.getByRole("button", { name: /SEO • validate/i });
    await expect(button).toBeEnabled();

    // Click and verify it disables
    await clickStable(button);
    await expect(button).toBeDisabled();

    // Wait for it to re-enable
    await expect(button).toBeEnabled({ timeout: 5000 });
  });

  test("displays approval notice", async ({ page }) => {
    await page.goto("/admin");

    // Wait for panel to load
    await waitPanel(page, "Agents — Approvals");

    // Verify the notice about approval is shown
    await expect(
      page.getByText(/All mutating tasks remain.*awaiting approval/i)
    ).toBeVisible();
  });
});
