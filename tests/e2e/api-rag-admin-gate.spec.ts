import { test, expect, request } from './test.base';

const BASE = process.env.API_BASE || 'http://127.0.0.1:8023';

// This spec checks that admin gates are enforced at the API layer.
// It does not depend on DOM and can run even without the web app.

test.describe('RAG projects admin gates', () => {
  test('POST /api/rag/ingest/projects → 403 without admin', async () => {
    const ctx = await request.newContext({ baseURL: BASE });
    const r = await ctx.post('/api/rag/ingest/projects');
    expect(r.status()).toBe(403);
    const body = await r.json();
    expect(body.detail).toBe('Admin required');
    await ctx.dispose();
  });

  test('POST /api/rag/projects/update → 403 without admin', async () => {
    const ctx = await request.newContext({ baseURL: BASE });
    const r = await ctx.post('/api/rag/projects/update', {
      data: { slug: 'demo', status: 'completed' }
    });
    expect(r.status()).toBe(403);
    const body = await r.json();
    expect(body.detail).toBe('Admin required');
    await ctx.dispose();
  });

  test('POST /api/rag/projects/update_nl → 403 without admin', async () => {
    const ctx = await request.newContext({ baseURL: BASE });
    const r = await ctx.post('/api/rag/projects/update_nl', {
      data: { instruction: 'mark demo completed' }
    });
    expect(r.status()).toBe(403);
    const body = await r.json();
    expect(body.detail).toBe('Admin required');
    await ctx.dispose();
  });

  test('ALLOW_TOOLS=1 allows in dev (skip if not set)', async () => {
    test.skip(!process.env.ALLOW_TOOLS, 'ALLOW_TOOLS not set in test environment');
    const ctx = await request.newContext({ baseURL: BASE });
    const r = await ctx.post('/api/rag/ingest/projects');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.ok).toBeTruthy();
    await ctx.dispose();
  });

  test('X-Admin-Token header allows admin access', async () => {
    test.skip(!process.env.ADMIN_TOKEN, 'ADMIN_TOKEN not set');
    const ctx = await request.newContext({ baseURL: BASE });

    // Test ingest endpoint
    const r1 = await ctx.post('/api/rag/ingest/projects', {
      headers: { 'X-Admin-Token': process.env.ADMIN_TOKEN! }
    });
    expect(r1.status()).toBe(200);
    const body1 = await r1.json();
    expect(body1.ok).toBeTruthy();
    expect(body1.by).toBe('token@admin');

    // Test structured update endpoint
    const r2 = await ctx.post('/api/rag/projects/update', {
      data: { slug: 'clarity', status: 'completed' },
      headers: { 'X-Admin-Token': process.env.ADMIN_TOKEN! }
    });
    expect(r2.status()).toBe(200);
    const body2 = await r2.json();
    expect(body2.ok).toBeTruthy();
    expect(body2.by).toBe('token@admin');

    // Test NL update endpoint
    const r3 = await ctx.post('/api/rag/projects/update_nl', {
      data: { instruction: 'mark clarity completed' },
      headers: { 'X-Admin-Token': process.env.ADMIN_TOKEN! }
    });
    expect(r3.status()).toBe(200);
    const body3 = await r3.json();
    expect(body3.ok).toBeTruthy();
    expect(body3.by).toBe('token@admin');

    await ctx.dispose();
  });
});
