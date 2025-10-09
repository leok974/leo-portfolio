import { test, expect, request } from './test.base';

const BASE = process.env.API_BASE || 'http://127.0.0.1:8023';

async function ctx() {
  return await request.newContext({ baseURL: BASE });
}

test.describe('RAG diagnostics admin gate', () => {
  test('403 without admin', async () => {
    const c = await ctx();
    const r = await c.get('/api/rag/diag/rag');
    expect(r.status()).toBe(403);
  });

  test('200 with ADMIN_TOKEN header (skip if not set)', async () => {
    test.skip(!process.env.ADMIN_TOKEN, 'ADMIN_TOKEN not set');
    const c = await ctx();
    const r = await c.get('/api/rag/diag/rag', {
      headers: { 'X-Admin-Token': process.env.ADMIN_TOKEN! },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.ok).toBeTruthy();
    expect(body.files?.projects_json).toBeTruthy();
  });
});
