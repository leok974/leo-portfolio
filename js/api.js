// api.js - centralized API helpers using window.__API_BASE__ (set in main.js)
// Safe to load early; falls back to reasonable defaults.
(function(){
  if (window.API) return; // idempotent
  const BASE = (window.__API_BASE__ || window.AGENT_BASE_URL || '/api').replace(/\/$/, '');

  async function http(path, { method='GET', headers={}, body, stream=false, signal } = {}){
    const url = BASE + path;
    const finalHeaders = Object.assign({}, headers);
    if (body && !(body instanceof FormData)){
      finalHeaders['Content-Type'] = finalHeaders['Content-Type'] || 'application/json';
      if (typeof body !== 'string') body = JSON.stringify(body);
    }
    const resp = await fetch(url, { method, headers: finalHeaders, body, signal });
    if (stream) return resp; // caller handles body
    if (!resp.ok) {
      const text = await resp.text().catch(()=> '');
      throw new Error(`HTTP ${resp.status} ${resp.statusText} ${text}`.trim());
    }
    const ct = resp.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) return resp.json();
    return resp.text();
  }

  // High-level endpoints
  const status = () => http('/status/summary');
  const chat = (messages) => http('/chat', { method:'POST', body: { messages } });
  const streamChat = async (messages, opts={}) => {
    return http('/chat/stream', { method:'POST', body:{ messages, stream:true }, stream:true, signal: opts.signal });
  };

  window.API = { base: BASE, http, status, chat, streamChat };
})();
