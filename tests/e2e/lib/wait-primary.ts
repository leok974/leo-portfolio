import { request, expect } from '@playwright/test';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Opts {
  serverTimeoutMs?: number;
  serverIntervalMs?: number;
  timeoutMs?: number;
  intervalMs?: number;
  metaTimeoutMs?: number;
  chatProbe?: boolean;
  chatTimeoutMs?: number;
}

export async function waitForPrimary(opts: Opts = {}) {
  // Align baseURL resolution with playwright.config.ts so helper works without explicit BASE_URL env
  const baseURL = process.env.BASE_URL || process.env.BASE || process.env.PROD_BASE || 'http://127.0.0.1:8080';
  const direct = process.env.BACKEND_DIRECT === '1';

  // Server phase knobs
  const serverTimeoutMs = Number(process.env.WAIT_SERVER_MS ?? opts.serverTimeoutMs ?? 120_000);
  const serverIntervalMs = Number(process.env.WAIT_SERVER_INTERVAL_MS ?? opts.serverIntervalMs ?? 1_000);
  // Primary/chat phase knobs
  const timeoutMs     = Number(process.env.WAIT_PRIMARY_MS ?? opts.timeoutMs ?? 90_000);
  const intervalMs    = Number(process.env.WAIT_PRIMARY_INTERVAL_MS ?? opts.intervalMs ?? 2_000);
  const metaTimeoutMs = Number(process.env.WAIT_PRIMARY_META_TIMEOUT_MS ?? opts.metaTimeoutMs ?? 5_000);
  const chatProbe     = String(process.env.WAIT_PRIMARY_CHAT_PROBE ?? (opts.chatProbe ?? '1')) === '1';
  const chatTimeoutMs = Number(process.env.WAIT_CHAT_MS ?? opts.chatTimeoutMs ?? 15_000);

  // Toggles
  const soft = String(process.env.WAIT_PRIMARY_SOFT ?? '0') === '1';
  const log  = String(process.env.WAIT_PRIMARY_LOG ?? '0') === '1';
  const allowFallback = String(process.env.ALLOW_FALLBACK ?? '0') === '1';

  const ctx = await request.newContext({ baseURL });

  // ===== Phase 0: server-up =====
  const serverStarted = Date.now();
  let serverTries = 0, serverOk = 0;
  const serverOkOnce = async () => {
    const paths = direct
      ? ['/ready', '/api/ready', '/api/status/summary']
      : ['/_up', '/api/ready', '/api/status/summary'];
    for (const p of paths) {
      try {
        serverTries++;
        const r = await ctx.get(p, { timeout: Math.max(1000, serverIntervalMs) });
        if (r.ok()) { serverOk++; return true; }
      } catch { /* ignore */ }
    }
    return false;
  };
  while (Date.now() - serverStarted < serverTimeoutMs) {
    if (await serverOkOnce()) break;
    await sleep(serverIntervalMs);
  }
  if (log) console.log(`[wait-primary] server phase: ok=${serverOk} tries=${serverTries} elapsed=${Date.now()-serverStarted}ms`);
  if (serverOk === 0) {
    const msg = `Server not reachable within ${serverTimeoutMs}ms (/_up|/api/ready|/api/status/summary)`;
    if (soft) console.warn('[wait-primary][soft] ' + msg); else expect.soft(false, msg).toBe(true);
  }

  // ===== Phase 1/2: meta + chat =====
  const pingStatuses: Array<number|string> = [];
  const summaryStatuses: Array<number|string> = [];
  let summaryLastBodySnippet = '';

  const probe = async (path: string, to: number) => {
    try {
      const r = await ctx.get(path, { timeout: to });
      return { ok: r.ok(), status: r.status(), text: await r.text() };
    } catch (e: any) {
      return { ok: false, status: `ERR:${String(e?.message || e)}`, text: '' };
    }
  };

  const okPrimaryPing = async () => {
    const res = await probe('/llm/primary/ping', metaTimeoutMs);
    pingStatuses.push(res.status);
    if (!res.ok) return false;
    try { const j = JSON.parse(res.text || '{}'); return !!(j?.ok && j?.served_by === 'primary'); } catch { return false; }
  };

  const okSummary = async () => {
    const res = await probe('/api/status/summary', metaTimeoutMs);
    summaryStatuses.push(res.status);
    if (!res.ok) { if (!summaryLastBodySnippet && res.text) summaryLastBodySnippet = res.text.slice(0,300); return false; }
    try {
      const j = JSON.parse(res.text || '{}');
      const present = !!(j?.ollama?.primary_model_present || j?.provider_ready);
      if (!summaryLastBodySnippet && res.text) summaryLastBodySnippet = res.text.slice(0,300);
      return present;
    } catch { return false; }
  };

  const okChatTiny = async () => {
    try {
      const chatPath = direct ? '/chat' : '/api/chat';
      const r = await ctx.post(chatPath, {
        data: { messages: [{ role: 'user', content: 'hi' }] },
        timeout: chatTimeoutMs,
        failOnStatusCode: false,
      });
      if (r.status() !== 200) return false;
      const body = await r.json();
      const t = JSON.stringify(body).toLowerCase();
      if (t.includes('served by fallback')) return !!allowFallback; // only OK when fallback explicitly allowed
      return true;
    } catch { return false; }
  };

  const started = Date.now();
  let rescueTried = false;
  while (Date.now() - started < timeoutMs) {
    const primary = (await okPrimaryPing()) || (await okSummary());
    if (primary) {
      if (!chatProbe) return;
      if (await okChatTiny()) return;
    } else {
      const half = (Date.now() - started) >= (timeoutMs / 2);
      if (half && chatProbe && !rescueTried) {
        rescueTried = true;
        if (await okChatTiny()) return;
      }
    }
    await sleep(intervalMs);
    if (log) {
      const elapsed = Date.now() - started;
      if (elapsed % (intervalMs * 5) < intervalMs) {
        console.log(`[wait-primary] elapsed=${elapsed}ms statuses ping=${JSON.stringify(pingStatuses.slice(-3))} summary=${JSON.stringify(summaryStatuses.slice(-3))}`);
      }
    }
  }

  // ===== Failure summary =====
  const uniq = <T>(arr: T[]) => Array.from(new Set(arr)).slice(-5);
  const statusLine = `ping=${JSON.stringify(uniq(pingStatuses))} summary=${JSON.stringify(uniq(summaryStatuses))}`;
  const snap = summaryLastBodySnippet || (await ctx.get('/api/status/summary').then(r => r.text()).catch(() => '[unreachable]'));
  const msg = `Primary model/chat not ready within ${timeoutMs}ms. ${statusLine}. SummarySample=${snap}`;
  if (soft) console.warn('[wait-primary][soft] ' + msg); else expect.soft(false, msg).toBe(true);
}
