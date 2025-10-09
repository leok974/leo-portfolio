import { test, expect } from './test.base';
import { waitForPrimary } from './lib/wait-primary';
import { snapSummary } from './lib/snap-summary';

let shouldMarkColdStart = true;

// Skip entirely if no BASE_URL/BASE configured (avoids invalid URL errors in ad-hoc runs)
if (!process.env.BASE_URL && !process.env.BASE && !process.env.PROD_BASE) {
  test.skip(true, 'BASE_URL not set; skipping first-chunk streaming test');
}

// Extended timeout to allow for large model cold start + first token
test.setTimeout(130_000);

test.describe('@backend chat stream first-chunk', () => {
  test.beforeAll(async () => { await waitForPrimary({ chatProbe: true }); });

  test('first SSE chunk arrives and looks valid', async ({ page, request }) => {
    const direct = process.env.BACKEND_DIRECT === '1';
    const streamPath = direct ? '/chat/stream' : '/api/chat/stream';
    // quick pre-ping (OPTIONS) to provide immediate diagnostic if mapping missing
    try {
      const ping = await request.fetch(streamPath, { method: 'OPTIONS', timeout: 3000, failOnStatusCode: false });
      if (ping.status() === 404) {
        throw new Error(`Routing missing for ${streamPath} (404). Set BACKEND_DIRECT=1 for direct backend or fix nginx mapping.`);
      }
    } catch (e: any) {
      throw new Error(`Cannot reach ${streamPath}: ${e.message}`);
    }

    const _totalMs = Number(process.env.WAIT_SSE_MS ?? 90_000); // reserved for future aggregated timeout logic
    const attemptMs = Number(process.env.WAIT_SSE_ATTEMPT_MS ?? 30_000);
    const startTotal = Date.now();

    await page.goto('/');

    const buf = await page.evaluate(async ({ timeoutMs, path }: { timeoutMs: number; path: string }) => {
      const ctrl = new AbortController();
      const start = Date.now();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      let provider = 'unknown';
      const setProvider = (candidate: unknown) => {
        if (typeof candidate !== 'string' || !candidate.trim()) return;
        if (provider === 'unknown') provider = candidate.trim();
      };
      try {
        const res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
          signal: ctrl.signal,
        });
        if (!res.ok) return `HTTP ${res.status}`;
        const reader = res.body!.getReader();
        const td = new TextDecoder();
        let acc = '';
        while (true) {
          const { done, value } = await reader.read();
            if (done) break;
            acc += td.decode(value, { stream: true });
            if (acc.includes('_served_by')) {
              const inline = acc.match(/"_served_by"\s*[:=]\s*"?([a-zA-Z0-9_-]+)/);
              if (inline?.[1]) setProvider(inline[1]);
              const eventMatch = acc.match(/event:\s*(?:_served_by|meta)[\s\S]*?data:\s*(.+)/);
              if (eventMatch) {
                const rawLine = eventMatch[1].split(/\r?\n/)[0]?.trim() ?? '';
                if (rawLine) {
                  if (rawLine.startsWith('{') || rawLine.startsWith('[')) {
                    try {
                      const parsed = JSON.parse(rawLine);
                      if (typeof parsed === 'string') setProvider(parsed);
                      else if (typeof parsed?.provider === 'string') setProvider(parsed.provider);
                      else if (typeof parsed?._served_by === 'string') setProvider(parsed._served_by);
                      else if (typeof parsed?.served_by === 'string') setProvider(parsed.served_by);
                    } catch { /* ignore parse errors */ }
                  } else {
                    setProvider(rawLine.replace(/^"|"$/g, ''));
                  }
                }
              }
            }
            if (acc.includes('event: _served_by') || acc.match(/^data: .*"role":"assistant"/m)) {
              // stamp latency on window for report annotation
              (window as any).__first_token_latency_ms = Date.now() - start;
              (window as any).__first_token_provider = provider;
              break;
            }
        }
        return { buffer: acc, provider };
      } catch (e: any) {
        return { buffer: `ERR ${String(e?.message || e)}`, provider };
      } finally {
        clearTimeout(timer);
      }
    }, { timeoutMs: attemptMs, path: streamPath });

  interface SSEEvalResult { buffer: string; provider: string }
    const evalResult: SSEEvalResult = (buf && typeof buf === 'object' && 'buffer' in buf && 'provider' in buf)
      ? (buf as SSEEvalResult)
      : { buffer: String(buf ?? ''), provider: 'unknown' };
    const textBuf = String(evalResult.buffer ?? '');
    const hasEarly = /event: _served_by|^data:/m.test(textBuf);
    const providerFromEval = evalResult.provider?.trim() ? evalResult.provider.trim() : undefined;
    const provider = providerFromEval ?? (() => {
      const provMatch = textBuf.match(/_served_by["']?[:=]["']?([a-zA-Z0-9_-]+)/);
      if (provMatch?.[1]) return provMatch[1];
      return 'unknown';
    })();
    const allowFallback = process.env.ALLOW_FALLBACK === '1';
    let ok = hasEarly;
    // If we aborted before early markers but summary later shows primary model present, treat as soft pass when fallback allowed
    if (!ok && allowFallback) {
      ok = /HTTP 4\d\d/.test(textBuf) ? false : /ERR/.test(textBuf) ? false : false; // keep strict for outright errors
    }
    if (process.env.STREAM_LATENCY_LOG === '1') {
      const ms = await page.evaluate('window.__first_token_latency_ms || 0');
      console.log(`[stream-first-chunk] first_token=${ms}ms total_elapsed=${Date.now()-startTotal}ms`);
      test.info().annotations.push(
        { type: 'stream-first-token-ms', description: String(ms) },
        { type: 'stream-provider', description: String(provider) }
      );
      if (shouldMarkColdStart) {
        test.info().annotations.push({ type: 'stream-coldstart', description: '1' });
        shouldMarkColdStart = false;
      }
    }

    if (!ok) {
      const summary = await snapSummary();
      throw new Error(`No early SSE meta/data within ${attemptMs}ms. Buf="${textBuf.slice(0,200)}..." Summary=${summary}`);
    }
    expect(ok).toBe(true);
  });
});
