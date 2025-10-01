import { test, expect, request as pwRequest } from '@playwright/test';
import { BASE } from './helpers/env';

// Backend status summary health (structure-aware) separate from UI pill

test('backend status summary is healthy', async () => {
  const api = await pwRequest.newContext();
  const res = await api.get(`${BASE}/api/status/summary`, { headers: { 'Accept': 'application/json' } });
  expect(res.ok(), 'summary endpoint should be reachable').toBeTruthy();
  const body: any = await res.json();
  expect(body, 'summary payload should include ready flag').toHaveProperty('ready');
  expect(body.ready).toBe(true);
  expect(body, 'summary payload should include rag.ok').toHaveProperty(['rag', 'ok']);
  expect(body.rag.ok).toBe(true);
  // Provide artifact for diagnostics
  test.info().attach('summary.json', { body: JSON.stringify(body, null, 2), contentType: 'application/json' });
});
