import { test, expect } from './test.base';
import { waitForPrimary } from './lib/wait-primary';

const BASE_URL = process.env.BASE_URL || process.env.BASE || process.env.PROD_BASE || 'http://127.0.0.1:8080';

async function postStream(messages: Array<{ role: string; content: string }>) {
  const supportsSignalTimeout = typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function';
  let controller: AbortController | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let signal: AbortSignal | undefined;

  if (supportsSignalTimeout) {
    signal = (AbortSignal as any).timeout(Number(process.env.WAIT_SSE_ATTEMPT_MS) || 30_000);
  } else if (typeof AbortController !== 'undefined') {
    controller = new AbortController();
    signal = controller.signal;
    timeoutId = setTimeout(() => controller?.abort(), Number(process.env.WAIT_SSE_ATTEMPT_MS) || 30_000);
  }

  const response = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal
  });

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  return response;
}

test.describe('@backend stream yields assistant text', () => {
  test.beforeAll(async () => {
    await waitForPrimary({ chatProbe: true });
  });

  test('stream produces text or cleanly falls back', async () => {
    const response = await postStream([{ role: 'user', content: 'Brief hello.' }]);
    expect(response.ok).toBeTruthy();

    const body = response.body;
    expect(body).toBeTruthy();

    const reader = body?.getReader?.();
    expect(reader).toBeTruthy();

    const decoder = new TextDecoder();
    const deadline = Date.now() + (Number(process.env.WAIT_SSE_ATTEMPT_MS) || 30_000);
    let hadToken = false;
    let sawDone = false;

    if (!reader) {
      throw new Error('No readable stream from /api/chat/stream response');
    }

    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      const text = decoder.decode(value, { stream: true });

      // Check for [DONE] marker
      if (/data:\s*\[DONE\]/.test(text)) {
        sawDone = true;
        break;
      }

      // Check for content in various formats
      if (/data:\s*{/.test(text) && /content/.test(text)) {
        hadToken = true;
        break;
      }

      // Also check for delta patterns
      if (text.includes('"delta"') && text.includes('"content"')) {
        hadToken = true;
        break;
      }

      if (text.includes('"role":"assistant"') && text.includes('"content"')) {
        hadToken = true;
        break;
      }
    }

    await reader.cancel().catch(() => undefined);

    expect(hadToken || sawDone, 'SSE produced neither tokens nor [DONE]').toBeTruthy();
  });
});
