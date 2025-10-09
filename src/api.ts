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

// Upload API helpers
export interface UploadResponse {
  ok: boolean;
  url: string;
  kind: 'image' | 'video';
  item?: any;
  lint_ok?: boolean;
}

export interface GalleryAddRequest {
  title: string;
  description?: string;
  type: 'image' | 'video-local' | 'youtube' | 'vimeo';
  src: string;
  poster?: string;
  mime?: string;
  tools?: string[];
  workflow?: string[];
  tags?: string[];
}

export interface GalleryAddResponse {
  ok: boolean;
  item: any;
  lint_ok: boolean;
}

function getCsrfToken(): string {
  // Try localStorage first (set by backend or previous auth)
  const stored = localStorage.getItem('csrf_token');
  if (stored) return stored;

  // Try meta tag (if backend injected it)
  const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
  if (meta?.content) return meta.content;

  return '';
}

export async function uploadFile(formData: FormData): Promise<UploadResponse> {
  const csrfToken = getCsrfToken();
  const headers: Record<string, string> = {};
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

  const resp = await fetch(BASE + '/uploads', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: formData
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Upload failed: ${resp.status} ${text}`);
  }

  return resp.json();
}

export async function galleryAdd(payload: GalleryAddRequest): Promise<GalleryAddResponse> {
  const csrfToken = getCsrfToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

  const resp = await fetch(BASE + '/gallery/add', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Gallery add failed: ${resp.status} ${text}`);
  }

  return resp.json();
}

// PR Automation API helpers
export interface PRCreateRequest {
  branch?: string;
  title?: string;
  body?: string;
  labels?: string[];
  base?: string;
  commit_message?: string;
  dry_run?: boolean;
  use_llm?: boolean;
}

export interface PRCreateResponse {
  status: string;
  branch?: string;
  pr?: string;
  labels?: string[];
  diff?: string;
  message?: string;
}

export async function approveAndOpenPR(options: {
  labels?: string[];
  use_llm?: boolean;
  attach_insights?: boolean;
  branch?: string;
  title?: string;
  body?: string;
  dry_run?: boolean;
}): Promise<PRCreateResponse> {
  const payload: PRCreateRequest = {
    labels: options.labels || ['auto', 'siteagent'],
    use_llm: options.use_llm ?? false,
    branch: options.branch,
    title: options.title,
    body: options.body,
    dry_run: options.dry_run ?? false,
  };

  const csrfToken = getCsrfToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer dev'  // Dev auth for agent endpoints
  };
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

  const resp = await fetch(BASE + '/agent/artifacts/pr', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`PR creation failed: ${resp.status} ${text}`);
  }

  return resp.json();
}

// Expose for legacy inline usage if needed
(window as any).API = { base: BASE, http, status, statusWithFallback, chat, streamChat, uploadFile, galleryAdd, approveAndOpenPR };

export const API = (window as any).API as {
  base: string;
  http: typeof http;
  status: typeof status;
  statusWithFallback: typeof statusWithFallback;
  chat: typeof chat;
  streamChat: typeof streamChat;
  uploadFile: typeof uploadFile;
  galleryAdd: typeof galleryAdd;
  approveAndOpenPR: typeof approveAndOpenPR;
};
