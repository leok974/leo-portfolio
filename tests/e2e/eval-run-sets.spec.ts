import { test, expect, request } from "@playwright/test";
const API  = process.env.API_BASE || "http://127.0.0.1:8023";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((value) => {
    (window as any).__API_BASE__ = value;
  }, API);
});

test.describe("Admin Eval run-set selector", () => {
  test.setTimeout(120_000);
  test("runs Regression only when selected", async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const select = page.getByTestId("admin-eval-select");
    await expect(select).toBeVisible({ timeout: 10000 });
    await select.click();
    // Click the Radix option by role/name to avoid portal/focus flakiness
    await page.getByRole('option', { name: 'Regression' }).click();

    const runBtn = page.getByTestId("admin-eval-run");
    const t0 = Date.now();
    await runBtn.click();

    const req = await request.newContext();
    await expect.poll(async () => {
      const hist = await req.get(`${API}/api/eval/history?limit=8`);
      if (!hist.ok()) return false;
      const data = await hist.json();
      const items = data.items || [];
      return items.some((x: any) => {
        const tsOk = x.ts && (new Date(x.ts).getTime() >= t0);
        const files: string[] = x.files || [];
        const match = files.includes("evals/regression.jsonl") && files.length === 1;
        return tsOk && match;
      });
    }, { timeout: 60000, intervals: [500, 1000, 2000, 3000] }).toBeTruthy();
  });

  test("runs Full when selected", async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const select = page.getByTestId("admin-eval-select");
    await expect(select).toBeVisible({ timeout: 10000 });
    await select.click();
    await page.getByRole('option', { name: 'Full (all)' }).click();

    const runBtn = page.getByTestId("admin-eval-run");
    const t0 = Date.now();
    await runBtn.click();
    // Wait until history shows a run that includes all expected files (baseline, planning, regression)
    const req2 = await request.newContext();
    await expect.poll(async () => {
      const hist = await req2.get(`${API}/api/eval/history?limit=8`);
      if (!hist.ok()) return false;
      const data = await hist.json();
      const items = data.items || [];
      return items.some((x: any) => {
        const tsOk = x.ts && (new Date(x.ts).getTime() >= t0);
        const files: string[] = x.files || [];
        const want = [
          "evals/baseline.jsonl",
          "evals/tool_planning.jsonl",
          "evals/regression.jsonl"
        ];
        const match = want.every(w => files.includes(w));
        return tsOk && match;
      });
    }, { timeout: 60000, intervals: [500, 1000, 2000, 3000] }).toBeTruthy();
  });
});
