import { describe, it, expect, vi, beforeEach } from 'vitest';
import { statusWithFallback } from '../src/api';

// Helper to build a mock fetch sequence: each entry can be { ok, status, json }
function sequence(responses: Array<{ ok: boolean; status: number; json?: any; throws?: boolean }>) {
  let i = 0;
  return vi.fn(async (_url: string) => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    if (r.throws) throw new Error(`network fail ${i}`);
    return {
      ok: r.ok,
      status: r.status,
      json: async () => r.json ?? {},
      headers: { get: () => 'application/json' }
    } as any;
  });
}

describe('statusWithFallback', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('succeeds on first endpoint', async () => {
    (globalThis as any).fetch = sequence([
      { ok: true, status: 200, json: { llm: { path: 'local' }, rag: { ok: true }, openai_configured: true } }
    ]);
    const s = await statusWithFallback({ attempts: 2 });
    expect(s._source).toBe('/status/summary');
    expect(s.llm?.path).toBe('local');
  });

  it('falls through summary -> health -> ready success', async () => {
    (globalThis as any).fetch = sequence([
      { ok: false, status: 500 }, // /status/summary attempt 1
      { ok: false, status: 404 }, // /llm/health attempt 1
      { ok: true, status: 200, json: { llm_path: 'fallback' } }, // /ready attempt 1
    ]);
    const s = await statusWithFallback({ attempts: 1 });
    expect(s._source).toBe('/ready');
  // For /ready fallback we currently normalize to 'fallback' (not 'unknown')
  expect(s.llm?.path).toBe('fallback');
  });

  it('retries with backoff and then succeeds', async () => {
    (globalThis as any).fetch = sequence([
      { ok: false, status: 500 }, // summary attempt 1
      { ok: false, status: 500 }, // health attempt 1
      { ok: false, status: 500 }, // ready attempt 1
      { ok: false, status: 500 }, // summary attempt 2
      { ok: true, status: 200, json: { llm: { path: 'local' } } }, // health attempt 2
    ]);
    const start = Date.now();
    const s = await statusWithFallback({ attempts: 2 });
    const elapsed = Date.now() - start;
    expect(s._source).toBe('/llm/health');
    // Ensure there was at least one backoff delay (>= ~200ms best effort). Allow generous margin.
    expect(elapsed).toBeGreaterThanOrEqual(200);
  });

  it('throws with collected errors when all fail', async () => {
    (globalThis as any).fetch = sequence([
      { ok: false, status: 500 }, { ok: false, status: 500 }, { ok: false, status: 500 },
      { ok: false, status: 500 }, { ok: false, status: 500 }, { ok: false, status: 500 },
    ]);
    await expect(statusWithFallback({ attempts: 2 })).rejects.toThrow('All status endpoints failed');
  });
});
