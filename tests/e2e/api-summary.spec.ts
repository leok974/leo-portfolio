import { test, expect, request as pwRequest } from '@playwright/test';
import { BASE } from './helpers/env';

// Only treat backend as strictly required when explicitly set to '1'
const BACKEND_REQUIRED = process.env.BACKEND_REQUIRED === '1';

// Backend status summary health (structure-aware) separate from UI pill
test.describe('@backend backend status', () => {
test('summary is healthy', async () => {
  const api = await pwRequest.newContext();

  // Poll loop: up to 20s (10 * 2s) waiting for ready true unless warming state accepted.
  const maxAttempts = 10;
  const delayMs = 2000;
  let lastBody: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res;
    try {
      res = await api.get(`${BASE}/api/status/summary`, { headers: { 'Accept': 'application/json' } });
    } catch (e: any) {
      test.skip(!BACKEND_REQUIRED, `Summary unreachable (connection error ${e?.code || e?.message || ''}) in frontend-only mode`);
      throw e;
    }
    if (!res.ok()) {
      test.skip(!BACKEND_REQUIRED, `Summary returned status ${res.status()} (frontend-only mode allows skip)`);
    }
    try {
      lastBody = await res.json();
    } catch (parseErr: any) {
      const text = await res.text();
      const looksHtml = /<html/i.test(text);
      test.skip(!BACKEND_REQUIRED && looksHtml, `Received HTML instead of JSON (likely static frontend only). Skipping.`);
      throw parseErr;
    }

    // Basic structure assertions each pass
    expect(lastBody, 'summary payload should include ready flag').toHaveProperty('ready');
    expect(lastBody, 'summary payload should include rag.ok').toHaveProperty(['rag', 'ok']);

    const warming = lastBody?.llm?.path === 'warming';
    const ready = lastBody.ready === true;
    const ragOk = lastBody?.rag?.ok === true;

    if (ready && ragOk) {
      // Success path
      break;
    }
    if (!ready && warming && ragOk) {
      // Accept warming state without polling further (explicit user request tolerance)
      break;
    }
    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, delayMs));
      continue;
    }
  }

  test.info().attach('summary.json', { body: JSON.stringify(lastBody, null, 2), contentType: 'application/json' });

  // Final assertion: either ready true OR (ready false & warming) and rag ok
  const finalWarming = lastBody?.llm?.path === 'warming';
  expect(lastBody?.rag?.ok, 'rag.ok should be true').toBe(true);
  if (lastBody.ready !== true) {
    expect(finalWarming, `Expected warming allowance when not ready (llm.path='warming') but got ${lastBody?.llm?.path}`).toBe(true);
  }
});
});
