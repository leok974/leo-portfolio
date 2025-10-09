import { test, expect, request as pwRequest } from './test.base';
import { BASE } from './helpers/env';

test.describe('@backend quick ping', () => {
test('ping or ready responds', async () => {
  const api = await pwRequest.newContext();
  const tryGet = async (path: string) => {
    try { return await api.get(`${BASE}${path}`, { headers: { Accept: 'application/json' } }); }
    catch { return null; }
  };
  let res = await tryGet('/api/ping');
  if (!res || !res.ok()) res = await tryGet('/api/ready');
  const backendRequired = process.env.BACKEND_REQUIRED === '1';
  if (!res || !res.ok()) {
    test.skip(!backendRequired, 'No /api/ping or /api/ready available; skipping (frontend-only).');
  }
  const body: any = await res!.json().catch(() => ({}));
  expect(body.ok === true || body.ready === true).toBeTruthy();
});
});
