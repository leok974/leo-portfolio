// Minimal dependency-free module for a single global status pill
// Converted to JSDoc-typed variant (no @ts-nocheck) for stricter checkJs.
(function(global){
  /**
   * @typedef {{ llm: { path: string }; rag: { ok: boolean }; openai_configured: boolean; tooltip?: string; _source?: string }} SummaryLike
   * @typedef {{ start: ()=>void; updateServed: (served:string)=>void; _fetchStatus: ()=>Promise<SummaryLike>; probeAll: ()=>Promise<any> }} AgentStatusShape
  * @typedef {Window & { AgentStatus?: Partial<AgentStatusShape>; __AGENT_STATUS_INIT__?: boolean; __AGENT_FETCH_STATUS?: ()=>Promise<SummaryLike>; __API_BASE__?: string; AGENT_BASE_URL?: string }} AgentWindow
   */
  /** @type {AgentWindow} */
  const gw = /** @type {any} */ (global);
  // Initialize AgentStatus with a no-op updateServed to satisfy global type expectations
  gw.AgentStatus = gw.AgentStatus || /** @type {any} */({
    /** no-op until real method attached */
  /** @param {string} _s */
  updateServed: (_s) => { /* intentionally empty */ }
  });

  const _isPages = typeof location !== 'undefined' && location.hostname.endsWith('github.io'); // unused (info only)
  // Multi-base fallback: primary unified assistant domain, then legacy app domain (with /api), then local.
  // Default remote-first ordering; will be reordered to favor local when running on localhost to speed up readiness.
  const BASES = [
    'https://assistant.ledger-mind.org/api',
    'https://app.ledger-mind.org/api',
    '/api'
  ];
  try {
    if (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)/.test(location.hostname)) {
      // Move local '/api' to front to avoid waiting on remote DNS/timeouts in dev.
      const idx = BASES.indexOf('/api');
      if (idx > 0) { BASES.splice(0,0, BASES.splice(idx,1)[0]); }
    }
  } catch(_e) { /* non-browser or restricted */ }
  const userOverride = (gw.__API_BASE__ || gw.AGENT_BASE_URL || '').replace(/\/$/, '');
  // If user override provided, prioritize it.
  if (userOverride) BASES.unshift(userOverride);
  /** @type {string | null} */
  let ACTIVE_BASE = null;

  function _pickBase(){ return ACTIVE_BASE || BASES[0]; }
  const REFRESH_MS = 30_000;
  const CANDIDATES = ['/status/summary','/llm/health','/ready'];

  /** @returns {HTMLElement | null} */
  const el = () => document.querySelector('[data-status-pill], #agent-status');

  /** @param {string} color */
  function dot(color){ const d=document.createElement('span'); d.className='agent-dot'; d.style.background=color; return d; }

  /** @param {SummaryLike} s */
  function classify(s){
    if (s.llm.path !== 'down' && s.rag.ok && s.openai_configured) return 'ok';
    if (s.llm.path !== 'down' || s.rag.ok || s.openai_configured) return 'warn';
    return 'err';
  }

  /** @param {SummaryLike} s */
  function label(s){
    const llm = s.llm.path;
    const k = s.openai_configured ? 'yes' : 'no';
    const r = s.rag.ok ? 'ok' : 'err';
    return `LLM: ${llm} • OpenAI key: ${k} • RAG: ${r}`;
  }

  async function fetchStatus(){
    const maybeApi = /** @type {any} */ (gw).API;
    if (maybeApi?.status) {
  try { return await maybeApi.status(); } catch (_e) { /* fall through */ }
    }
    let lastErr = null;
    // Iterate bases then candidates
    for (const base of BASES) {
      const baseTrim = base.replace(/\/$/, '');
      for (const p of CANDIDATES) {
      try {
        const url = baseTrim + p;
        const r = await fetch(url, { mode:'cors', credentials:'omit', headers:{ 'Accept':'application/json' } });
        if (!r.ok) { lastErr = `${p} -> ${r.status}`; continue; }
        // Some endpoints may not include full summary; coerce minimal shape
        const ct = r.headers.get('content-type') || '';
        /** @type {any} */
        let body = {};
        if (ct.includes('application/json')) {
          try { body = await r.json(); } catch { body = {}; }
        }
        if (!body.llm) body.llm = { path: 'unknown' };
        if (!body.rag) body.rag = { ok: true };
        if (typeof body.openai_configured === 'undefined') body.openai_configured = true;
        body._source = p;
        ACTIVE_BASE = baseTrim; // lock in successful base
        gw.AGENT_BASE_URL = baseTrim; // expose globally for other modules
        return body;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        lastErr = `${p} -> ${msg}`;
      }
      }
    }
    if (lastErr) console.warn('[agent-status] all probes failed:', lastErr);
    throw new Error(lastErr || 'all probes failed');
  }

  /** @param {SummaryLike} s */
  function render(s){
    const node = el(); if (!node) return;
    node.classList.remove('ok','warn','err');
    node.classList.add(classify(s));
    const color = s.llm.path==='local' ? '#2ecc71' : s.llm.path==='fallback' ? '#f1c40f' : '#e74c3c';
    const text = document.createElement('span');
    text.className = 'agent-kv';
    text.textContent = 'Status';
    node.replaceChildren(
      dot(color),
      text
    );
    const tip = s.tooltip ? `${label(s)}\n${s.tooltip}` : label(s);
    node.setAttribute('data-tip', tip);
    node.title = tip;
  }

  async function tick(){
    try { const data = await fetchStatus(); render(data); }
    catch { render({ llm:{path:'down'}, openai_configured:false, rag:{ok:false}, tooltip:'All probes failed' }); }
  }

  /** @param {string} served */
  function updateServed(served){
    // Programmatic quick update when we know which path served the response
    const path = served === 'fallback' ? 'fallback' : 'local';
    render({ llm:{ path }, openai_configured:true, rag:{ ok:true }, tooltip: 'Live stream metadata' });
  }

  function start(){
    if (el()) { tick(); setInterval(tick, REFRESH_MS); }
    // Live path updates come from chat streaming (assistant-dock.js) via AgentStatus.updateServed.
    // We intentionally avoid opening an EventSource here because /chat/stream is POST-only.
  }

  // NOTE: Removed stray expression referencing updateServed (lint cleanup). If reintroduced ensure it's used as a call.

  // Expose internal fetchStatus for test harness (_fetchStatus) without documenting publicly
  // Expose a pure probe function (no render side-effects) for unit tests
  async function probeAll(){
    let lastErr = null;
  for (const base of BASES) {
      const bt = base.replace(/\/$/, '');
      for (const p of CANDIDATES){
        try {
          const r = await fetch(bt + p, { mode:'cors', credentials:'omit', headers:{'Accept':'application/json'} });
          if (!r.ok) { lastErr = `${bt}${p} -> ${r.status}`; continue; }
          return { ok: true, base: bt, path: p };
        } catch(e){ const msg = e instanceof Error ? e.message : String(e); lastErr = `${bt}${p} -> ${msg}`; }
      }
    }
    return { ok: false, error: lastErr };
  }

  gw.AgentStatus = Object.assign(gw.AgentStatus||{}, { start, updateServed, _fetchStatus: fetchStatus, probeAll, classify }); // attach API
  try { gw.__AGENT_FETCH_STATUS = fetchStatus; } catch(_ignored) {}
  // Initialize only once (idempotent) but never block export attachment for tests.
  if (!gw.__AGENT_STATUS_INIT__) {
    gw.__AGENT_STATUS_INIT__ = true;
    if (gw.addEventListener) {
      gw.addEventListener('DOMContentLoaded', start);
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);

// Fast hydration: opportunistic quick readiness class/text set prior to periodic probes.
try {
  if (typeof window !== 'undefined') {
    const pill = document.querySelector('[data-status-pill], #agent-status');
    if (pill) {
      if (!pill.textContent || !pill.textContent.trim()) pill.textContent = 'Checking…';
      (async () => {
        const origin = location.origin;
        /** @type {Response | null} */
        let res = null;
        try { res = await fetch(origin + '/api/ready', { headers: { 'Accept':'application/json' } }); } catch { /* ignore */ }
        if (!res || !res.ok) {
          try { res = await fetch(origin + '/api/ping', { headers: { 'Accept':'application/json' } }); } catch { /* ignore */ }
        }
        if (res && res.ok) {
          let body = {}; try { body = await res.clone().json(); } catch { /* body may be empty */ }
          const ready = /** @type {any} */(body).ready === true || /** @type {any} */(body).ok === true;
          if (ready) {
            pill.classList.remove('warn','err');
            pill.classList.add('ok');
            if (/^Checking…?$/.test(pill.textContent.trim())) pill.textContent = 'Ready';
            pill.setAttribute('data-tip', pill.getAttribute('data-tip') || 'Backend ready');
          }
        }
      })();
    }
  }
} catch(_e) { /* non-fatal */ }

// Pure helper for CSS class composition (no DOM needed)
/** @param {'ok'|'warn'|'err'|'pending'|'error'} state */
export function pillClasses(state){ return ['pill', `pill--${state}`].join(' '); }
// Re-export selected internals for tests (fallback if script executed before ESM import resolution)
const __AG = /** @type {any} */ (typeof window !== 'undefined' ? window : {});
export const probeAll = __AG.AgentStatus?.probeAll || (async ()=>({ ok:false, error:'not-in-browser'}));
function __fallbackClassify(/** @type {any} */ s){
  return (s?.llm?.path && s?.rag?.ok && s?.openai_configured) ? 'ok' : 'warn';
}
export const classify = __AG.AgentStatus?.classify || __fallbackClassify;
