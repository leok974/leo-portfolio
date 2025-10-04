import { request } from '@playwright/test';

export async function snapSummary() {
  const ctx = await request.newContext({ baseURL: process.env.BASE_URL || process.env.BASE || 'http://127.0.0.1:8080' });
  try {
    const r = await ctx.get('/api/status/summary', { timeout: 3000 });
    return await r.text();
  } catch {
    return '[summary unreachable]';
  }
}
