// api.js - centralized API helpers (runtime JS with JSDoc for type safety)
// Internal factory to create an API bound to a base URL
/**
 * @param {string} base
 */
function createApi(base){
  return {
    base,
    /** @param {string} path @param {any} [opts] */
    http: (path, opts) => http(path, opts),
    status: () => http('/status/summary'),
    /** @param {Array<{role:string;content:string}>} messages */
    chat: (messages) => http('/chat', { method:'POST', body:{ messages } }),
    /** @param {Array<{role:string;content:string}>} messages @param {{ signal?: AbortSignal }} [opts] */
    streamChat: (messages, opts={}) => http('/chat/stream', { method:'POST', body:{ messages, stream:true }, stream:true, signal: opts.signal })
  };
}

(function(){
  /** @typedef {{ role: string; content: string }} ChatMessage */
  /** @typedef {{ base: string; http: typeof http; status: ()=>Promise<any>; chat: (messages: ChatMessage[])=>Promise<any>; streamChat: (messages: ChatMessage[], opts?: { signal?: AbortSignal })=>Promise<Response> }} APIShape */
  /** @typedef {Window & typeof globalThis & { API?: APIShape; __API_BASE__?: string; AGENT_BASE_URL?: string }} APIWindow */
  /** @type {APIWindow} */
  const w = /** @type {any} */ (window);
  if (w.API) return;
  const isPages = typeof location !== 'undefined' && location.hostname.endsWith('github.io');
  const BASE = (w.__API_BASE__ || w.AGENT_BASE_URL || (isPages ? 'https://assistant.ledger-mind.org/api' : '/api')).replace(/\/$/, '');

  /**
   * Generic HTTP wrapper (optionally with custom base for tests via third arg)
   * @param {string} path
   * @param {{ method?: string; headers?: Record<string,string>; body?: any; stream?: boolean; signal?: AbortSignal }} [opts]
   * @param {string} [overrideBase]
   * @returns {Promise<any|Response>}
   */
  async function http(path, { method='GET', headers={}, body, stream=false, signal } = {}, overrideBase){
    const url = (overrideBase || BASE) + path;
    /** @type {Record<string,string>} */
    const finalHeaders = { ...headers };
    let sendBody = body;
    if (sendBody && !(sendBody instanceof FormData)) {
      finalHeaders['Content-Type'] = finalHeaders['Content-Type'] || 'application/json';
      if (typeof sendBody !== 'string') sendBody = JSON.stringify(sendBody);
    }
    const resp = await fetch(url, { method, headers: finalHeaders, body: sendBody, signal });
    if (stream) return resp;
    if (!resp.ok) {
      const text = await resp.text().catch(()=> '');
      throw new Error(`HTTP ${resp.status} ${resp.statusText} ${text}`.trim());
    }
    const ct = resp.headers.get('Content-Type') || '';
    return ct.includes('application/json') ? resp.json() : resp.text();
  }

  const apiObj = createApi(BASE);
  w.API = w.API || apiObj;
  // Stash low-level for module exports
  // augment global typing in-place (runtime only)
  /** @type {any} */(w).__API_EXPORTS__ = {
    http,
    /** @param {string} base */
    statusBase: (base) => http('/status/summary', {}, base),
    /** @param {string} base @param {Array<{role:string;content:string}>} messages */
    chatBase: (base, messages) => http('/chat', { method:'POST', body:{ messages } }, base),
    /** @param {string} base @param {Array<{role:string;content:string}>} messages @param {{ signal?: AbortSignal }} [opts] */
    streamChatBase: (base, messages, opts={}) => http('/chat/stream', { method:'POST', body:{ messages, stream:true }, stream:true, signal: opts.signal }, base)
  };
})();

// Module exports (work in bundler & tests). If window absent, build minimal shim.
const __G = (typeof window !== 'undefined' ? window : /** @type {any} */({ __API_EXPORTS__: undefined }));

/** @param {string} base */
export function status(base){ return __G.__API_EXPORTS__.statusBase(base); }
/** @param {string} base @param {Array<{role:string;content:string}>} messages */
export function chat(base, messages){ return __G.__API_EXPORTS__.chatBase(base, messages); }
/** @param {string} base @param {Array<{role:string;content:string}>} messages @param {{ signal?: AbortSignal }} [opts] */
export function streamChat(base, messages, opts={}){ return /** @type {Promise<Response>} */(__G.__API_EXPORTS__.streamChatBase(base, messages, opts)); }
/** Low-level http for tests */
/**
 * @param {string} path
 * @param {{ method?: string; headers?: Record<string,string>; body?: any; stream?: boolean; signal?: AbortSignal }} [opts]
 * @param {string} [overrideBase]
 */
export function http(path, opts, overrideBase){ return __G.__API_EXPORTS__.http(path, opts, overrideBase); }
