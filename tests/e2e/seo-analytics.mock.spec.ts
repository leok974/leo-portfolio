import { test, expect, request as PWRequest } from './test.base';
import { waitForArtifact } from './helpers/waitForArtifact';

const BE = process.env.BACKEND_URL || 'http://127.0.0.1:8001';
const UI = process.env.UI_URL || 'http://127.0.0.1:5173';

test.describe('@backend SEO Analytics (mock fast)', () => {
  test.setTimeout(30_000); // Mock should be much faster than real run

  test('mock run → artifact present → validates structure', async () => {
    const api = await PWRequest.newContext({
      baseURL: BE,
      extraHTTPHeaders: { Authorization: 'Bearer dev' },
      timeout: 30000
    });

    // 1) Trigger mock (instant write)
    const run = await api.post('/agent/run/mock', { data: { threshold: 0.02 } });
    expect(run.ok()).toBeTruthy();

    const runData = await run.json();
    expect(runData.ok).toBe(true);
    expect(runData.mock).toBe(true);
    expect(runData.count).toBe(2);

    // 2) Poll for artifact via backend (should be immediate)
    const json = await waitForArtifact(
      api,
      '/agent/artifacts/seo-tune.json',
      { Authorization: 'Bearer dev' },
      10_000
    );

    expect(Array.isArray(json.pages)).toBeTruthy();
    expect(json.pages.length).toBe(2);
    expect(json.threshold).toBe(0.02);
    expect(json.generated).toBeTruthy();

    // Validate mock pages structure
    const byUrl = Object.fromEntries(json.pages.map((p: any) => [p.url, p]));
    expect(byUrl['/']).toBeTruthy();
    expect(byUrl['/'].notes).toBe('mock');
    expect(byUrl['/projects/siteagent']).toBeTruthy();
    expect(byUrl['/projects/siteagent'].notes).toBe('mock');

    // 3) Verify MD artifact also generated
    const md = await waitForArtifact(
      api,
      '/agent/artifacts/seo-tune.md',
      { Authorization: 'Bearer dev' },
      5_000
    );

    expect(md).toContain('SEO Tune Report (mock)');
    expect(md).toContain('Threshold: 0.02');
    expect(md).toContain('Pages: 2');

    await api.dispose();
  });

  test('mock with custom threshold', async () => {
    const api = await PWRequest.newContext({
      baseURL: BE,
      extraHTTPHeaders: { Authorization: 'Bearer dev' },
      timeout: 30000
    });

    // Trigger with custom threshold
    const run = await api.post('/agent/run/mock', { data: { threshold: 0.05 } });
    expect(run.ok()).toBeTruthy();

    const json = await waitForArtifact(
      api,
      '/agent/artifacts/seo-tune.json',
      { Authorization: 'Bearer dev' },
      10_000
    );

    expect(json.threshold).toBe(0.05);

    await api.dispose();
  });

  test('seo-tune mock includes sha256 integrity', async () => {
    const api = await PWRequest.newContext({
      baseURL: BE,
      extraHTTPHeaders: { Authorization: 'Bearer dev' },
      timeout: 30000
    });

    const res = await api.post('/agent/run/mock', { data: { threshold: 0.02 } });
    expect(res.ok()).toBeTruthy();

    const json = await res.json();
    const integrity = json?.integrity;

    expect(integrity?.algo).toBe('sha256');
    expect(typeof integrity?.value).toBe('string');
    expect(integrity?.value.length).toBeGreaterThanOrEqual(64);
    expect(integrity?.size).toBeGreaterThan(0);

    // Also verify integrity field is in the artifact file
    const artifact = await waitForArtifact(
      api,
      '/agent/artifacts/seo-tune.json',
      { Authorization: 'Bearer dev' },
      10_000
    );

    expect(artifact.integrity).toBeTruthy();
    expect(artifact.integrity.algo).toBe('sha256');
    expect(artifact.integrity.value).toBe(integrity.value);

    await api.dispose();
  });

  test.skip('UI path: sees mock artifact link', async ({ page }) => {
    // This test checks if the UI properly displays the artifact link
    // Skip for now since UI integration is not complete
    const api = await PWRequest.newContext({
      baseURL: BE,
      extraHTTPHeaders: { Authorization: 'Bearer dev' },
      timeout: 30000
    });

    // Trigger mock
    await api.post('/agent/run/mock', { data: { threshold: 0.02 } });
    await waitForArtifact(
      api,
      '/agent/artifacts/seo-tune.json',
      { Authorization: 'Bearer dev' },
      10_000
    );

    // Check UI
    await page.goto(`${UI}/agent-tools.html`);

    const hasAuth = await page.locator('#seo-auth').isVisible().catch(() => false);
    if (hasAuth) {
      await page.fill('#seo-auth', 'dev');
    }

    const hasPanel = await page.locator('[data-testid="seo-analytics-panel"]')
      .isVisible()
      .catch(() => false);

    if (!hasPanel) {
      test.skip(true, 'SEO Analytics panel not available in UI yet');
    }

    await expect(page.getByTestId('seo-tune-artifact-link')).toBeVisible();

    await api.dispose();
  });
});
