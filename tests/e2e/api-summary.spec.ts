import { test, expect, request as pwRequest } from '@playwright/test';
import { BASE } from './helpers/env';

const BACKEND_REQUIRED = process.env.BACKEND_REQUIRED !== '0';

// Backend status summary health (structure-aware) separate from UI pill

test('backend status summary is healthy', async () => {
  const api = await pwRequest.newContext();
  let res;
  try {
    res = await api.get(`${BASE}/api/status/summary`, { headers: { 'Accept': 'application/json' } });
  } catch (e: any) {
    test.skip(!BACKEND_REQUIRED, `Summary unreachable (connection error ${e?.code || e?.message || ''}) in frontend-only mode`);
    throw e; // Will not run when skipped
  }
  if (!res.ok()) {
    test.skip(!BACKEND_REQUIRED, `Summary returned status ${res.status()} (frontend-only mode allows skip)`);
  }
  let body: any = null;
  try {
    body = await res.json();
  } catch (parseErr: any) {
    const text = await res.text();
    const looksHtml = /<html/i.test(text);
    test.skip(!BACKEND_REQUIRED && looksHtml, `Received HTML instead of JSON (likely static frontend only). Skipping.`);
    // If backend required, rethrow to surface failure
    throw parseErr;
  }
  expect(body, 'summary payload should include ready flag').toHaveProperty('ready');
  expect(body.ready).toBe(true);
  expect(body, 'summary payload should include rag.ok').toHaveProperty(['rag', 'ok']);
  expect(body.rag.ok).toBe(true);
  test.info().attach('summary.json', { body: JSON.stringify(body, null, 2), contentType: 'application/json' });
});
