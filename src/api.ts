// api.ts - centralized API helpers (TypeScript)
export interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string; }
export interface StreamMeta { _served_by?: string; [k: string]: any }
export interface StatusSummary { llm?: { path?: string }; rag?: { ok?: boolean }; openai_configured?: boolean; tooltip?: string }

const isPages = typeof location !== 'undefined' && location.hostname.endsWith('github.io');
const BASE: string = ((window as any).__API_BASE__ || (window as any).AGENT_BASE_URL || (isPages ? 'https://assistant.ledger-mind.org/api' : '/api')).replace(/\/$/, '');

async function http<T=any>(path: string, opts: { method?: string; headers?: Record<string,string>; body?: any; stream?: boolean; signal?: AbortSignal } = {}): Promise<T|Response> {
  const { method='GET', headers={}, body, stream=false, signal } = opts;
  let finalBody = body;
  const finalHeaders = { ...headers };
  if (finalBody && !(finalBody instanceof FormData)) {
    finalHeaders['Content-Type'] = finalHeaders['Content-Type'] || 'application/json';
    if (typeof finalBody !== 'string') finalBody = JSON.stringify(finalBody);
  }
  const resp = await fetch(BASE + path, { method, headers: finalHeaders, body: finalBody, signal });
  if (stream) return resp;
  if (!resp.ok) {
    const text = await resp.text().catch(()=> '');
    throw new Error(`HTTP ${resp.status} ${resp.statusText} ${text}`.trim());
  }
  const ct = resp.headers.get('Content-Type') || '';
  return (ct.includes('application/json') ? resp.json() : resp.text()) as Promise<T>;
}

export const status = async () => {
  try {
    return await http<StatusSummary>('/status/summary');
  } catch (err: any) {
    // Legacy fallback: if primary path fails (404 / network) try legacy root-level path when on Pages
    if (typeof location !== 'undefined' && location.hostname.endsWith('github.io')) {
      try { return await http<StatusSummary>('/../status/summary'); } catch {}
    }
    throw err;
  }
};

// Unified status with multi-endpoint fallback & exponential backoff.
// Tries /status/summary -> /llm/health -> /ready across N attempts with delays.
export async function statusWithFallback(options: { attempts?: number; baseOverride?: string } = {}): Promise<StatusSummary & { _source?: string; _errors?: string[] }>{
  const attempts = options.attempts ?? 3;
  const baseRoot = (options.baseOverride || BASE).replace(/\/api$/, '');
  const chain = ['/status/summary','/llm/health','/ready'];
  const errors: string[] = [];
  for (let attempt=1; attempt<=attempts; attempt++) {
    for (const path of chain) {
      const url = path === '/status/summary' ? BASE + '/status/summary' : baseRoot + path;
      try {
        const resp = await fetch(url, { method:'GET', headers:{ 'Accept':'application/json' }, credentials:'omit', mode:'cors' as RequestMode });
        if (!resp.ok) { errors.push(`${path} -> ${resp.status}`); continue; }
        const data: any = await resp.json().catch(()=> ({}));
        data._source = path;
        if (!data.llm) data.llm = { path: data.llm_path || (path === '/ready' ? 'unknown' : 'fallback') };
        if (!data.rag) data.rag = { ok: true };
        if (typeof data.openai_configured === 'undefined') data.openai_configured = true;
        if (errors.length) data._errors = [...errors];
        return data;
      } catch (e: any) {
        errors.push(`${path} -> ${e?.message || e}`);
      }
    }
    if (attempt < attempts) {
      const delayMs = 250 * Math.pow(2, attempt-1); // 250, 500, 1000...
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  const err = new Error('All status endpoints failed');
  (err as any).errors = errors;
  throw err;
}
export const chat = (messages: ChatMessage[]) => http('/chat', { method:'POST', body: { messages } });
export const streamChat = (messages: ChatMessage[], opts: { signal?: AbortSignal } = {}) => http<Response>('/chat/stream', { method:'POST', body:{ messages, stream:true }, stream:true, signal: opts.signal });

// Expose for legacy inline usage if needed
(window as any).API = { base: BASE, http, status, statusWithFallback, chat, streamChat };

export const API = (window as any).API as {
  base: string;
  http: typeof http;
  status: typeof status;
  statusWithFallback: typeof statusWithFallback;
  chat: typeof chat;
  streamChat: typeof streamChat;
};
