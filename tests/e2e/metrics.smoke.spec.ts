import { test, expect, request } from '@playwright/test';

test('metrics endpoint reachable', async () => {
  const base = process.env.E2E_BASE || process.env.EDGE_BASE || 'http://127.0.0.1:8080';
  const ctx = await request.newContext();
  const res = await ctx.get(`${base}/metrics`);
  expect(res.ok()).toBeTruthy();
  const text = await res.text();
  // Smoke: just assert we get prometheus exposition format
  expect(text).toContain('# HELP');
});
