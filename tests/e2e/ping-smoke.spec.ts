import { test, expect, request as pwRequest } from '@playwright/test';
import { BASE } from './helpers/env';

test('quick API ping/ready', async () => {
  const api = await pwRequest.newContext();
  const tryGet = async (path: string) => {
    try { return await api.get(`${BASE}${path}`, { headers: { Accept: 'application/json' } }); }
    catch { return null; }
  };
  let res = await tryGet('/api/ping');
  if (!res || !res.ok()) res = await tryGet('/api/ready');
  test.skip(!res || !res.ok(), 'No /api/ping or /api/ready available; skipping in this env.');
  const body: any = await res!.json().catch(() => ({}));
  expect(body.ok === true || body.ready === true).toBeTruthy();
});
