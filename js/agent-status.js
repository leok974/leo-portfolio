// Minimal dependency-free module for a single global status pill
(function(){
  if (window.__AGENT_STATUS_INIT__) return; window.__AGENT_STATUS_INIT__ = true;

  const BASE       = (window.AGENT_BASE_URL || 'http://127.0.0.1:8001');
  const STATUS_URL = BASE + '/status/summary';
  const REFRESH_MS = 30_000;

  const el = () => document.getElementById('agent-status');

  function dot(color){ const d=document.createElement('span'); d.className='agent-dot'; d.style.background=color; return d; }

  function classify(s){
    if (s.llm.path !== 'down' && s.rag.ok && s.openai_configured) return 'ok';
    if (s.llm.path !== 'down' || s.rag.ok || s.openai_configured) return 'warn';
    return 'err';
  }

  function label(s){
    const llm = s.llm.path;
    const k = s.openai_configured ? 'yes' : 'no';
    const r = s.rag.ok ? 'ok' : 'err';
    return `LLM: ${llm} • OpenAI key: ${k} • RAG: ${r}`;
  }

  async function fetchStatus(){
    const res = await fetch(STATUS_URL, { headers:{ 'Accept':'application/json' } });
    if (!res.ok) throw new Error('status fetch failed');
    return res.json();
  }

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
    try { render(await fetchStatus()); }
    catch { render({ llm:{path:'down'}, openai_configured:false, rag:{ok:false} }); }
  }

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

  window.AgentStatus = Object.assign(window.AgentStatus||{}, { start, updateServed });
  window.addEventListener('DOMContentLoaded', start);
})();
