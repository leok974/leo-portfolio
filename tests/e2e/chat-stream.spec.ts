import { test, expect } from './test.base';
test.setTimeout(130_000);
import { waitForPrimary } from './lib/wait-primary';
import { snapSummary } from './lib/snap-summary';

const backendRequired = process.env.BACKEND_REQUIRED === '1';

if (!backendRequired) {
  test.describe.skip('@backend chat stream', () => {});
} else {
  test.describe('@backend chat stream', () => {
    test.describe.configure({ timeout: 120000 });
    test.beforeAll(async () => { await waitForPrimary({ chatProbe: true }); });
    test('POST /api/chat/stream yields early SSE meta', async ({ page }) => {
      const totalMs = Number(process.env.WAIT_SSE_MS ?? 90_000);
      const attemptMs = Number(process.env.WAIT_SSE_ATTEMPT_MS ?? 30_000);
      const logLatency = process.env.STREAM_LATENCY_LOG === '1';
      const deadline = Date.now() + totalMs;
      let lastBuf = '';
      let lastStatus = 0;
      let firstTokenLatencyMs: number | null = null;
      await page.goto('/');
      while (Date.now() < deadline) {
        const startAttempt = Date.now();
        const buf = await page.evaluate(async (timeoutMs: number) => {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), timeoutMs);
          try {
            const res = await fetch('/api/chat/stream', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
              signal: ctrl.signal
            });
            if (!res.ok) return `HTTP ${res.status}`;
            const reader = res.body!.getReader();
            const td = new TextDecoder();
            let acc = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              acc += td.decode(value, { stream: true });
              if (acc.includes('event: _served_by') || acc.match(/^data: .*"role":"assistant"/m)) break;
            }
            return acc;
          } catch (e: any) {
            return `ERR ${String(e?.message || e)}`;
          } finally { clearTimeout(timer); }
        }, attemptMs);
        lastBuf = String(buf);
        const m = /^HTTP (\d+)/.exec(lastBuf); lastStatus = m ? Number(m[1]) : 0;
        if (/event: _served_by|^data:/m.test(lastBuf)) {
          if (firstTokenLatencyMs == null) firstTokenLatencyMs = Date.now() - startAttempt;
          if (logLatency && firstTokenLatencyMs != null) {
            console.log(`[stream-latency] first_token=${firstTokenLatencyMs}ms attempt_window=${attemptMs} total_budget=${totalMs}`);
          }
          // Attach as annotation for report consumers
          test.info().annotations.push({ type: 'stream-first-token-ms', description: String(firstTokenLatencyMs ?? -1) });
          expect(lastBuf).toMatch(/event: _served_by|^data:/m);
          return;
        }
        await page.waitForTimeout(500);
      }
      const summary = await snapSummary();
      const msg = `SSE did not produce early meta within ${totalMs}ms. LastBuf="${lastBuf.slice(0,200)}..." Status=${lastStatus}. Summary=${summary}`;
      if (process.env.ALLOW_STREAM_FLAKY === '1') {
        console.warn('[ALLOW_STREAM_FLAKY] ' + msg);
        return;
      }
      throw new Error(msg);
    });
  });
}
