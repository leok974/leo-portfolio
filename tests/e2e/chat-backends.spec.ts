import { test, expect } from '@playwright/test';
import { waitForPrimary } from './lib/wait-primary';

// Allow long warmup if globalSetup skipped
test.setTimeout(130_000);

const backendRequired = process.env.BACKEND_REQUIRED === '1';

test.describe('@backend chat backends JSON', () => {
  test.skip(!backendRequired, 'Set BACKEND_REQUIRED=1 to run backend e2e.');

  test.beforeAll(async () => { await waitForPrimary({ chatProbe: true }); });

  test('POST /api/chat includes backends with last_backend values', async ({ request }) => {
      // Ensure RAG is ready; otherwise skip to avoid false negatives when no retrieval happens
      const ready = await request.get('/api/ready', { headers: { Accept: 'application/json' } });
      if (!ready.ok()) test.skip(true, '/api/ready not reachable');
      try {
        const jr = await ready.json();
        if (!jr?.rag?.ok || !jr?.rag?.chunks || jr.rag.chunks < 1) {
          test.skip(true, 'RAG not ready (no chunks) — skipping embeddings backend assertion.');
        }
      } catch {
        /* ignore parse errors */
      }
      const prompt = 'Briefly summarize the LedgerMind project with 2 bullets.'; // triggers RAG → embeddings/rerank
      const res = await request.post('/api/chat', {
        data: { messages: [{ role: 'user', content: prompt }], include_sources: true },
      });
      expect(res.status(), 'chat endpoint should return 200').toBe(200);
      const body = await res.json();

      // Assert backends snapshot is present in the JSON response
      expect(body).toHaveProperty('backends');
      const backends = body.backends || {};
      expect(typeof backends).toBe('object');

      // Embeddings backend should be recorded as 'local' or 'openai'
      const emb = backends.embeddings || {};
      expect(emb).toHaveProperty('last_backend');
      const embBackend = String(emb.last_backend || '').toLowerCase();
      expect(['local', 'openai']).toContain(embBackend);
      // If we have a latency, it should be a positive number
      if (emb.last_ms != null) expect(Number(emb.last_ms)).toBeGreaterThan(0);

      // Rerank is optional but if present should follow the same convention
      const rr = backends.rerank || {};
      if (rr && rr.last_backend != null) {
        const rrBackend = String(rr.last_backend || '').toLowerCase();
        expect(['local', 'openai', '']).toContain(rrBackend);
        if (rr.last_ms != null) expect(Number(rr.last_ms)).toBeGreaterThan(0);
      }
  });
});
