import { test, expect, request as PWRequest } from '@playwright/test';

/**
 * Phase 50.6.2 - SEO Analytics E2E Tests
 *
 * Tests the complete analytics ingestion → SEO tune → artifact generation flow
 * with LLM-based rewriting and graceful fallback to heuristics.
 *
 * Uses dedicated API context for backend calls (8001) separate from UI navigation (5173).
 */

const BE = process.env.BACKEND_URL || 'http://127.0.0.1:8001';
const UI = process.env.UI_URL || 'http://127.0.0.1:5173';

// Helpers
async function llmIsReachable(api: import('@playwright/test').APIRequestContext) {
  // Prefer latency probe (documented in README/API). If not present, try /llm/health.
  const probes = ['/llm/primary/latency', '/llm/health'];
  for (const p of probes) {
    try {
      const r = await api.get(p);
      if (r.ok()) return true;
    } catch {
      // Continue to next probe
    }
  }
  return false;
}

/**
 * Poll for artifact until it appears or timeout.
 * Useful since seo.tune runs asynchronously and may take several seconds.
 */
async function pollForArtifact(
  api: import('@playwright/test').APIRequestContext,
  url: string,
  timeoutMs = 45_000
): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const probe = await api.get(url);
    if (probe.ok()) {
      const data = await probe.json();
      // Check if artifact has actual content
      if (data && (Array.isArray(data.pages) ? data.pages.length > 0 : true)) {
        return data;
      }
    }
    await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
  }
  throw new Error(`Artifact ${url} not found after ${timeoutMs}ms`);
}

test.describe('@backend SEO Analytics Loop', () => {
  test.setTimeout(60_000); // Allow slow agent tasks
  test.slow(); // Mark as slow on CI

  test('ingest → tune → artifact shows LLM path when available', async () => {
    // 1) Create dedicated API context for backend (bypasses Vite proxy)
    const api = await PWRequest.newContext({
      baseURL: BE,
      extraHTTPHeaders: { Authorization: 'Bearer dev' },
      timeout: 60000  // 60s timeout for API calls
    });

    // 0) Check LLM wiring so we can assert "llm" deterministically
    const llmUp = await llmIsReachable(api);

    // 2) Ingest mock Search Console data
    const payload = {
      source: 'search_console',
      rows: [
        { url: '/', impressions: 2200, clicks: 12 },           // low CTR (~0.5%)
        { url: '/projects/siteagent', impressions: 1850, clicks: 11 },  // ~0.6%
        { url: '/projects/datapipe-ai', impressions: 1400, clicks: 6 }  // ~0.4%
      ]
    };
    const ingest = await api.post('/agent/analytics/ingest', { data: payload });
    expect(ingest.ok()).toBeTruthy();

    const ingestData = await ingest.json();
    expect(ingestData.inserted_or_updated).toBeGreaterThan(0);
    expect(ingestData.source).toBe('search_console');

    // 3) Run the tune task (LLM-first with heuristic fallback)
    const run = await api.post('/agent/run', { data: { plan: ['seo.tune'] } });
    expect(run.ok()).toBeTruthy();

    const runJson = await run.json();
    expect(runJson.run_id).toBeTruthy();
    expect(runJson.tasks).toContain('seo.tune');

    // 4) Poll for artifact (agent runs async, may take seconds)
    const data = await pollForArtifact(api, '/agent/artifacts/seo-tune.json');

    expect(Array.isArray(data.pages)).toBeTruthy();
    expect(data.pages.length).toBeGreaterThan(0);
    expect(data.threshold).toBe(0.02);
    expect(data.generated).toBeTruthy();

    // Ensure our URLs are present
    const byUrl = Object.fromEntries(data.pages.map((p: any) => [p.url, p]));
    expect(byUrl['/']).toBeTruthy();
    expect(byUrl['/projects/siteagent']).toBeTruthy();
    expect(byUrl['/projects/datapipe-ai']).toBeTruthy();

    // 5) Verify each page has required fields
    for (const p of data.pages) {
      expect(p.url).toBeTruthy();
      expect(typeof p.ctr).toBe('number');
      expect(p.ctr).toBeLessThan(0.02);  // Below threshold
      expect(p.new_title).toBeTruthy();
      expect(p.new_description).toBeTruthy();
      expect(p.notes).toBeTruthy();
      expect(['llm', 'heuristic']).toContain(p.notes);
    }

    // 6) Expectation: if LLM reachable, notes should be "llm" (end-to-end JSON-mode path);
    // otherwise, we accept "heuristic" but annotate skip clearly to avoid flake.
    const sample = data.pages[0];
    if (llmUp) {
      expect.soft(sample.notes).toBe('llm');
      // If somehow heuristic tripped despite LLM health, fail with context dump:
      if (sample.notes !== 'llm') {
        console.log('Expected LLM but got heuristic. Sample page:', JSON.stringify(sample, null, 2));
        test.fail(true, 'LLM appears reachable but seo.tune returned heuristic; check OPENAI_BASE_URL/MODEL and JSON mode');
      }
    } else {
      test.skip(true, 'LLM not reachable (latency/health probe failed) — heuristic fallback used; enable Ollama or fallback API to assert llm path.');
    }

    // 7) Optional sanity: ensure char limits are respected
    for (const p of data.pages) {
      if (p.new_title) {
        expect(p.new_title.length).toBeLessThanOrEqual(70);
        expect(p.new_title.length).toBeGreaterThan(0);
      }
      if (p.new_description) {
        expect(p.new_description.length).toBeLessThanOrEqual(155);
        expect(p.new_description.length).toBeGreaterThan(0);
      }
    }

    // 8) Verify CTR values match what we ingested
    expect(byUrl['/'].ctr).toBeCloseTo(12 / 2200, 4);
    expect(byUrl['/projects/siteagent'].ctr).toBeCloseTo(11 / 1850, 4);
    expect(byUrl['/projects/datapipe-ai'].ctr).toBeCloseTo(6 / 1400, 4);

    await api.dispose();
  });

  test('MD artifact is generated and readable', async () => {
    const api = await PWRequest.newContext({
      baseURL: BE,
      extraHTTPHeaders: { Authorization: 'Bearer dev' },
      timeout: 60000  // 60s timeout for API calls
    });

    // 1) Ingest data
    const payload = {
      source: 'search_console',
      rows: [
        { url: '/test-page', impressions: 1000, clicks: 5 }
      ]
    };
    await api.post('/agent/analytics/ingest', { data: payload });

    // 2) Run tune
    const run = await api.post('/agent/run', { data: { plan: ['seo.tune'] } });
    const runJson = await run.json();
    expect(runJson.run_id).toBeTruthy();

    // 3) Poll for MD artifact
    await pollForArtifact(api, '/agent/artifacts/seo-tune.json'); // Wait for JSON first
    const md = await api.get('/agent/artifacts/seo-tune.md');
    expect(md.ok()).toBeTruthy();

    const text = await md.text();
    expect(text).toContain('# SEO Tune Report');
    expect(text).toContain('Threshold:');
    expect(text).toContain('Pages:');
    expect(text).toMatch(/\/test-page|##/);  // Should have page sections

    await api.dispose();
  });

  test('custom threshold parameter works', async () => {
    const api = await PWRequest.newContext({
      baseURL: BE,
      extraHTTPHeaders: { Authorization: 'Bearer dev' },
      timeout: 60000  // 60s timeout for API calls
    });

    // 1) Ingest mixed CTR data
    const payload = {
      source: 'manual',
      rows: [
        { url: '/high-ctr', impressions: 1000, clicks: 100 },  // 10% CTR
        { url: '/low-ctr', impressions: 1000, clicks: 5 }      // 0.5% CTR
      ]
    };
    await api.post('/agent/analytics/ingest', { data: payload });

    // 2) Run tune with threshold=0.01 (1%)
    const run = await api.post('/agent/run', {
      data: { plan: ['seo.tune'], params: { threshold: 0.01 } }
    });
    const runJson = await run.json();
    expect(runJson.run_id).toBeTruthy();

    // 3) Poll for artifact
    const data = await pollForArtifact(api, '/agent/artifacts/seo-tune.json');

    // Should only include low-ctr (0.5% < 1%)
    expect(data.threshold).toBe(0.01);
    const urls = data.pages.map((p: any) => p.url);
    expect(urls).toContain('/low-ctr');
    expect(urls).not.toContain('/high-ctr');

    await api.dispose();
  });

  test('heuristic fallback works when LLM disabled', async () => {
    const api = await PWRequest.newContext({
      baseURL: BE,
      extraHTTPHeaders: { Authorization: 'Bearer dev' },
      timeout: 60000  // 60s timeout for API calls
    });

    // 1) Ingest data
    const payload = {
      source: 'test',
      rows: [
        { url: '/test-heuristic', impressions: 500, clicks: 3 }
      ]
    };
    await api.post('/agent/analytics/ingest', { data: payload });

    // 2) Run tune (system may have LLM disabled via SEO_LLM_ENABLED=0)
    const run = await api.post('/agent/run', { data: { plan: ['seo.tune'] } });
    const runJson = await run.json();
    expect(runJson.run_id).toBeTruthy();

    // 3) Poll for artifact
    const data = await pollForArtifact(api, '/agent/artifacts/seo-tune.json');

    // Should have at least one page with valid metadata
    expect(data.pages.length).toBeGreaterThan(0);
    const page = data.pages.find((p: any) => p.url === '/test-heuristic');
    expect(page).toBeTruthy();
    expect(page.new_title).toBeTruthy();
    expect(page.new_description).toBeTruthy();
    // notes will be either "llm" or "heuristic" depending on config
    expect(['llm', 'heuristic']).toContain(page.notes);

    await api.dispose();
  });

  test('multiple sources are tracked correctly', async () => {
    const api = await PWRequest.newContext({
      baseURL: BE,
      extraHTTPHeaders: { Authorization: 'Bearer dev' },
      timeout: 60000  // 60s timeout for API calls
    });

    // 1) Ingest from different sources
    await api.post('/agent/analytics/ingest', {
      data: {
        source: 'search_console',
        rows: [{ url: '/gsc-page', impressions: 1000, clicks: 5 }]
      }
    });

    await api.post('/agent/analytics/ingest', {
      data: {
        source: 'ga4',
        rows: [{ url: '/ga4-page', impressions: 800, clicks: 4 }]
      }
    });

    await api.post('/agent/analytics/ingest', {
      data: {
        source: 'manual',
        rows: [{ url: '/manual-page', impressions: 600, clicks: 3 }]
      }
    });

    // 2) Run tune
    const run = await api.post('/agent/run', { data: { plan: ['seo.tune'] } });
    const runJson = await run.json();
    expect(runJson.run_id).toBeTruthy();
    expect(runJson.tasks.length).toBeGreaterThanOrEqual(1);

    // 3) Poll for artifact and verify all pages present
    const data = await pollForArtifact(api, '/agent/artifacts/seo-tune.json');
    const urls = data.pages.map((p: any) => p.url);
    expect(urls).toContain('/gsc-page');
    expect(urls).toContain('/ga4-page');
    expect(urls).toContain('/manual-page');

    await api.dispose();
  });
});

test.describe('@frontend SEO Analytics Tools Panel (when available)', () => {
  test('UI path: upload file & run from Tools panel', async ({ page }) => {
    // This test is resilient: it uses the UI if present; otherwise it auto-skip with guidance.
    await page.goto(`${UI}/agent-tools.html`).catch(() => {});

    // Check if panel exists first
    const hasPanel = await page.locator('[data-testid="seo-analytics-panel"]')
      .first()
      .isVisible()
      .catch(() => false);

    if (!hasPanel) {
      test.skip(true, 'SEO Analytics Tools panel not found yet — enable after frontend wiring.');
    }

    // Ensure the Tools panel uses the Bearer token for /agent/* fetches
    const authInput = page.locator('#seo-auth');
    if (await authInput.isVisible().catch(() => false)) {
      await authInput.fill('dev');
    }

    // Create an in-page mock file and upload
    const mockGSC = {
      source: 'search_console',
      rows: [
        { url: '/projects/derma-ai', impressions: 1200, clicks: 10 },
        { url: '/projects/datapipe-ai', impressions: 1800, clicks: 9 }
      ]
    };
    const blob = new Blob([JSON.stringify(mockGSC)], { type: 'application/json' });
    const handle = await page.evaluateHandle(
      async (b) => new File([b], 'gsc.json', { type: 'application/json' }),
      blob
    );
    await page.setInputFiles('[data-testid="analytics-upload"]', [handle as any]);

    // Click "Ingest"
    const ingestBtn = page.getByTestId('analytics-ingest-btn');
    await expect(ingestBtn).toBeEnabled();
    await ingestBtn.click();

    // Wait for success indicator
    await expect(page.getByText(/ingested|success/i)).toBeVisible({ timeout: 5000 });

    // Click "Run Tune"
    const runBtn = page.getByTestId('seo-tune-run-btn');
    await expect(runBtn).toBeEnabled();
    await runBtn.click();

    // Wait for completion
    await expect(page.getByText(/complete|generated/i)).toBeVisible({ timeout: 10000 });

    // Open artifact link
    const link = page.getByTestId('seo-tune-artifact-link');
    await expect(link).toBeVisible();
    const [newPage] = await Promise.all([
      page.waitForEvent('popup'),
      link.click()
    ]);
    await newPage.waitForLoadState('domcontentloaded');

    // Validate content appears (either JSON or MD view)
    const bodyText = await newPage.locator('body').innerText();
    expect(bodyText).toMatch(/SEO Tune Report|"pages"\s*:/);
  });
});
