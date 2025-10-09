import { test, expect } from './test.base';

// Minimal smoke for Tools panel UI: dry-run and run button presence
// Assumes Admin dock is present on the page and AdminToolsPanel is mounted.

test.describe('Admin Tools panel', () => {
  test('dry-run shows result and run button is present', async ({ page, baseURL }) => {
    await page.goto(baseURL!);

    // Ensure the admin dock exists (panel floats bottom-right). We can rely on inputs data-testids.
    const scriptInput = page.getByTestId('tools-script-input');
    await expect(scriptInput).toBeVisible();

    // Fill script path from allowlist example; if not allowed, we still expect an error message box.
    await scriptInput.fill('scripts/rag-build-index.ps1');

    // Click dry-run and assert some feedback appears in the <pre> box.
    const dryBtn = page.getByTestId('tools-dryrun');
    await dryBtn.click();

    // We accept either a success (DRY-RUN OK) or a explicit error due to gating.
    const output = page.locator('pre');
    await expect(output).toBeVisible();
    await expect(output).toContainText(/DRY-RUN OK|❌/);

    // The Run (dangerous) button should be visible
    await expect(page.getByTestId('tools-run')).toBeVisible();
  });
});
