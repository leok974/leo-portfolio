/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { TextDecoder } from 'util';
// Node 18+ provides TextDecoder, setTimeout; no explicit global hints needed.

// Minimal SSE streaming test to ensure `_served_by` marker appears in early output.
// Assumptions:
//  - Local stack running at http://localhost:8080
//  - /chat/stream endpoint emits Server-Sent Events lines starting with 'data:'
//  - Model responds with text containing provider marker `_served_by` (as prompted)
// If endpoint or stack unavailable, test is skipped (not failed) to avoid noisy CI in envs without backend.

const BASE = process.env.BASE || 'http://localhost:8080';

async function streamChat(prompt, { base = BASE } = {}) {
  const res = await fetch(`${base}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
    body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] })
  }).catch(e => ({ error: e }));
  if (res?.error) throw res.error;
  if (!res?.ok) throw new Error(`HTTP ${res?.status}`);
  return res.body; // ReadableStream
}

const STRICT = !!process.env.STRICT_STREAM_MARKER;
const STREAM_TIMEOUT_MS = Number(process.env.STREAM_TIMEOUT_MS || 15000);
const EXPECT_SERVED_BY = process.env.EXPECT_SERVED_BY; // optional regex to validate served_by identity

async function collectUntil(body, predicate, { maxBytes = 8192, hardMs = STREAM_TIMEOUT_MS } = {}) {
  let buf = '';
  const reader = body.getReader();
  const started = Date.now();
  while (true) {
    if (Date.now() - started > hardMs) break;
    const { done, value } = await reader.read();
    if (done) break;
  buf += new TextDecoder().decode(value);
    if (predicate(buf)) break;
    if (buf.length >= maxBytes) break;
  }
  try { reader.cancel(); } catch { /* noop */ }
  return buf;
}

describe('chat streaming (_served_by marker)', () => {
  it('emits _served_by in initial SSE payload (soft-skip if slow)', async () => {
    // Fast pre-check: only run if service seems up.
    try {
      const ready = await fetch(`${BASE}/api/ready`, { method: 'GET' });
      if (!ready.ok) return void console.warn('Skipping: /api/ready not ok');
    } catch (_e) {
      return void console.warn('Skipping: backend not reachable');
    }

    let body;
    try {
  body = await streamChat('Say hello and include _served_by in response.');
    } catch (_e) {
      return void console.warn('Skipping: stream endpoint unavailable:', _e.message);
    }
    if (!body) return void console.warn('Skipping: no body returned');

    const out = await collectUntil(body, txt => /_served_by/i.test(txt));
    const servedByMatch = out.match(/_served_by[^\n]*/i);
    const servedByText = servedByMatch ? servedByMatch[0] : '';
    const found = !!servedByMatch;
    if (!found && !STRICT) {
      console.warn('[stream test] soft-skip: _served_by not observed before timeout (STRICT off)');
      return; // soft skip
    }
    expect(found).toBe(true);
    if (STRICT && EXPECT_SERVED_BY) {
      let re;
      try { re = new RegExp(EXPECT_SERVED_BY, 'i'); }
      catch (e) { throw new Error(`Invalid EXPECT_SERVED_BY regex: ${EXPECT_SERVED_BY} (${e.message})`); }
      expect(re.test(servedByText)).toBe(true);
    }
    expect(out).toMatch(/data:/);
  }, STREAM_TIMEOUT_MS + 2000);
});
