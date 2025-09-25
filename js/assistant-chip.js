// assistant-chip.js
// Idempotent mount; safe DOM creation; unified panel using site styles/IDs
// --- Agent status pill ---
// Exposes: window.AgentStatus.refresh(baseUrl), .bindSseMeta(eventSource), .updateServed(servedBy)
// Uses /llm/health and /ready to determine local/fallback/down, OpenAI key, and RAG status.
window.AgentStatus = (() => {
  const $ = sel => document.querySelector(sel);

  async function getJSON(url, timeoutMs=7000) {
    const c = new AbortController();
    const t = setTimeout(()=>c.abort(), timeoutMs);
    try {
      const r = await fetch(url, { signal:c.signal, credentials:'include' });
      clearTimeout(t);
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } catch (e) {
      clearTimeout(t);
      return null;
    }
  }

  function setDot(key, state) {
    const el = document.querySelector(`.agent-status .dot[data-k="${key}"]`);
    if (!el) return;
    el.classList.remove('ok','warn','err');
    if (state) el.classList.add(state);
  }

  function setLabel(text) {
    const el = document.querySelector('.agent-status .label[data-k="label"]');
    if (el) el.textContent = text;
    const pill = $('#agent-status');
    if (pill) pill.title = text;
  }

  function composeLabel({ llm, openai, rag }) {
    return `LLM: ${llm} • OpenAI key: ${openai ? 'yes' : 'no'} • RAG: ${rag ? 'ok' : 'err'}`;
  }

  async function refresh(baseUrl) {
    const [health, ready] = await Promise.all([
      getJSON(`${baseUrl}/llm/health`),
      getJSON(`${baseUrl}/ready`)
    ]);

    const ollamaUp = Boolean(health && health.status && health.status.ollama === 'up');
    const openaiConfigured = Boolean(
      (health && health.status && health.status.openai === 'configured') ||
      (ready && ready.checks && ready.checks.openai_fallback && ready.checks.openai_fallback.configured)
    );
    const ragOk = Boolean(ready && ready.checks && ready.checks.rag_db && ready.checks.rag_db.ok);

    setDot('llm', ollamaUp ? 'ok' : (openaiConfigured ? 'warn' : 'err'));
    setDot('openai', openaiConfigured ? 'ok' : 'err');
    setDot('rag', ragOk ? 'ok' : 'err');

    setLabel(composeLabel({
      llm: ollamaUp ? 'local' : (openaiConfigured ? 'fallback' : 'down'),
      openai: openaiConfigured,
      rag: ragOk
    }));
  }

  // Optional: hook an EventSource that emits 'meta' events to flip LLM status quickly
  function bindSseMeta(source) {
    if (!source || typeof source.addEventListener !== 'function') return;
    source.addEventListener('meta', (e) => {
      try {
        const meta = JSON.parse(e.data);
        const served = meta._served_by; // "primary" | "fallback"
        setDot('llm', served === 'primary' ? 'ok' : 'warn');
        const labelEl = document.querySelector('.agent-status .label[data-k="label"]');
        if (labelEl) labelEl.textContent = labelEl.textContent.replace(/LLM:\s*(local|fallback|down)/i,
          `LLM: ${served === 'primary' ? 'local' : 'fallback'}`);
      } catch {}
    });
  }

  // Direct programmatic update for non-EventSource streams
  function updateServed(served) {
    setDot('llm', served === 'primary' ? 'ok' : 'warn');
    const labelEl = document.querySelector('.agent-status .label[data-k="label"]');
    if (labelEl) labelEl.textContent = labelEl.textContent.replace(/LLM:\s*(local|fallback|down)/i,
      `LLM: ${served === 'primary' ? 'local' : 'fallback'}`);
  }

  return { refresh, bindSseMeta, updateServed };
})();

(function(){
  if (window.__ASSISTANT_CHIP_MOUNTED__) return;
  window.__ASSISTANT_CHIP_MOUNTED__ = true;

  function mountChip(){
    // Dedicated host
    let host = document.getElementById('assistant-chip-root');
    if (!host){
      host = document.createElement('div');
      host.id = 'assistant-chip-root';
      document.body.appendChild(host);
    }

    // Build wrapper
    const wrap = document.createElement('div');
    wrap.id = 'assistant-chip';
    wrap.style.cssText = [
      'position:fixed',
      'right: max(16px, env(safe-area-inset-right))',
      'bottom: max(16px, env(safe-area-inset-bottom))',
      'z-index:2147483642',
      'pointer-events:auto'
    ].join(';');

    // Unified panel markup (matches IDs styled in index.html)
    wrap.innerHTML = `
      <button id="assistant-chip-btn" aria-label="Ask about my projects">🤖 Ask about my projects…</button>
      <div id="assistant-panel" role="dialog" aria-modal="false" aria-label="Assistant panel" style="display:none">
        <div class="head">
          <strong>Portfolio Assistant</strong>
          <div class="agent-status" id="agent-status" title="status…">
            <span class="dot" data-k="llm"></span>
            <span class="dot" data-k="openai"></span>
            <span class="dot" data-k="rag"></span>
            <span class="label" data-k="label">checking…</span>
          </div>
          <button id="assistant-close" class="btn" type="button" aria-label="Close panel">Close</button>
        </div>
        <div id="assistant-log" aria-live="polite"></div>
        <form id="assistant-form" autocomplete="off">
          <input id="assistant-input" placeholder="Ask about my projects…" required aria-label="Your question" />
          <button class="btn" type="submit">Send</button>
        </form>
      </div>`;

    host.appendChild(wrap);

    // References
    const chipBtn = wrap.querySelector('#assistant-chip-btn');
    const panel   = wrap.querySelector('#assistant-panel');
    const form    = wrap.querySelector('#assistant-form');
    const input   = wrap.querySelector('#assistant-input');
    const logEl   = wrap.querySelector('#assistant-log');
    const closeBtn= wrap.querySelector('#assistant-close');

    // Toggle helpers
    function open(){ panel.style.display = 'flex'; input?.focus(); }
    function close(){ panel.style.display = 'none'; }

    // Open via chip or wrapper click
    chipBtn.addEventListener('click', open);
    wrap.addEventListener('click', (e)=>{
      // Only open if clicking the chip area, not when interacting with the form
      if (e.target === wrap) open();
    });
    closeBtn.addEventListener('click', close);

    // Esc to close
    document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && panel.style.display !== 'none') close(); });

    // Submit handler
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      if (typeof window.startStream === 'function') {
        window.startStream(q, { logEl });
      }
      input.value = '';
    });

    // Initialize AgentStatus
    try {
      const BACKEND = (window.AGENT_BASE_URL || 'http://127.0.0.1:8001');
      window.AgentStatus?.refresh(BACKEND).catch(()=>{});
      setInterval(()=> window.AgentStatus?.refresh(BACKEND).catch(()=>{}), 30000);
    } catch {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountChip);
  else mountChip();
})();
