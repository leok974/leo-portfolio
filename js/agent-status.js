// Minimal dependency-free module for status pill
(function(){
  if (window.__AGENT_STATUS_INIT__) return; window.__AGENT_STATUS_INIT__ = true;

  const STATUS_URL = (window.AGENT_BASE_URL || 'http://127.0.0.1:8001') + '/status/summary';
  const SSE_URL    = (window.AGENT_BASE_URL || 'http://127.0.0.1:8001') + '/chat/stream';
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
    node.replaceChildren(
      dot(s.llm.path==='local' ? '#2ecc71' : s.llm.path==='fallback' ? '#f1c40f' : '#e74c3c'),
      (()=>{const span=document.createElement('span'); span.className='agent-kv'; span.textContent = label(s); return span;})()
    );
    node.title = s.tooltip || 'Model & RAG status';
  }

  async function tick(){ try { render(await fetchStatus()); } catch { render({ llm:{path:'down'}, openai_configured:false, rag:{ok:false} }); } }

  function start(){
    // If pill exists in DOM (external one), start polling immediately
    if (el()) { tick(); setInterval(tick, REFRESH_MS); }

    // Optional: listen for meta events to live-update served_by
    try {
      const es = new EventSource(SSE_URL, { withCredentials:true });
      es.addEventListener('meta', e => {
        try {
          const m = JSON.parse(e.data||'{}');
          if (m && m._served_by) {
            render({ llm:{ path: m._served_by==='fallback' ? 'fallback' : 'local' }, openai_configured:true, rag:{ok:true} });
          }
        } catch {}
      });
    } catch {}
  }

  window.AgentStatus = window.AgentStatus || { start };
  window.addEventListener('DOMContentLoaded', start);
})();
