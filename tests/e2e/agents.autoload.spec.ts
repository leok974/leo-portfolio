import { test, expect } from "@playwright/test";
import { clickStable, waitPanel } from "./helpers/ui";

test("quick-run → approval panel auto-loads @agents-autoload", async ({ page }) => {
  await page.goto("/admin"); // adjust route if needed

  // Wait for panels to be ready
  await waitPanel(page, "Agents — Approvals");

  // Run a preset
  await clickStable(page.getByRole("button", { name: /SEO • validate/i }));

  // Toast should appear
  await expect(page.getByRole("status")).toContainText("task_id", { timeout: 5000 });

  // The approval panel should auto-load and show a status soon after
  await expect
    .poll(async () => {
      const txt = await page.locator("text=Agents — Approvals").locator("..").innerText();
      return /status:\s*(awaiting_approval|succeeded|running|queued)/i.test(txt);
    }, { timeout: 10000 })
    .toBeTruthy();
});

test("deep link with ?task_id=UUID auto-loads task @agents-autoload", async ({ page }) => {
  // First create a task to get a real task_id
  await page.goto("/admin");

  // Wait for panels to be ready
  await waitPanel(page, "Agents — Approvals");

  await clickStable(page.getByRole("button", { name: /SEO • validate/i }));

  // Wait for toast to get task_id
  const toastLocator = page.getByRole("status");
  await expect(toastLocator).toBeVisible({ timeout: 5000 });

  // Extract task_id from toast message
  const toastText = await toastLocator.innerText();
  const taskIdMatch = toastText.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);

  if (taskIdMatch) {
    const taskId = taskIdMatch[1];

    // Navigate with query param
    await page.goto(`/admin?task_id=${taskId}`);

    // Verify task auto-loaded in approval panel
    await expect(page.locator("input[value='" + taskId + "']")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=/status:/i")).toBeVisible({ timeout: 5000 });
  }
});
