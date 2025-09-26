// assistant-dock.js - stream-capable assistant UI (singleton + HMR-safe)
(function(){
  // ---- Singleton guard (prevents duplicate mounts & listeners) ----
  if (window.__assistantDockMounted) {
    document.querySelectorAll('.assistant-dock').forEach((el, i) => { if (i > 0) el.remove(); });
    console.warn('[assistant] duplicate mount prevented');
    return;
  }
  window.__assistantDockMounted = true;

  // Optional: HMR cleanup so re-mounts don’t stack
  let __assistantCleanup = () => {};
  try {
    if (import.meta && import.meta.hot) {
      import.meta.hot.dispose(() => {
        try { __assistantCleanup(); } catch {}
        window.__assistantDockMounted = false;
      });
    }
  } catch {}

  // Remove any legacy assistant UIs that might autospawn
  try { document.querySelectorAll('.assistant-chip-panel,.assistant-fab,.assistant-old').forEach(el=> el.remove()); } catch {}

  const AVATARS = {
    ai:  'assets/icons/assistant-robot.svg',
    user: null
  };

  const root    = document.getElementById('assistantDock') || document.querySelector('.assistant-dock');
  const dock    = root; // alias
  const chipBtn = document.getElementById('assistantChip');
  const close   = root?.querySelector('.assistant-close');
  const log     = root?.querySelector('.chat-log');
  const form    = root?.querySelector('.chat-composer');
  const input   = root?.querySelector('input[name="q"], #chatInput');
  const servedBySpan = root?.querySelector('.served-by, #servedBy');

  // Apply muted tint from CSS vars to the header label
  try{ if (servedBySpan) servedBySpan.style.color = getComputedStyle(document.documentElement).getPropertyValue('--lk-muted') || '#b4c0cf'; } catch {}

  const API_BASE   = (window.AGENT_BASE_URL || 'http://127.0.0.1:8001');
  const API_STREAM = API_BASE + '/chat/stream';
  const API_CHAT   = API_BASE + '/chat';
  // Streaming config constants
  const STREAM_MAX_RETRIES = 2;            // additional attempts after first try
  const STREAM_RETRY_BASE_MS = 500;        // base backoff
  const STREAM_RETRY_JITTER_MS = 250;      // random jitter
  const STREAM_OVERALL_TIMEOUT_MS = 45_000; // total wall time cap for streaming
  const STREAM_INACTIVITY_TIMEOUT_MS = 8_000; // abort if no data events within this window

  // Focus management + session persistence helpers
  let lastTriggerEl = null;

  function openDock(){
    if (!dock) return;
    dock.hidden = false;
    chipBtn?.classList.add('is-hidden');
    chipBtn?.setAttribute('aria-expanded','true');
    requestAnimationFrame(()=> input?.focus());
  }

  function closeDock(){
    if (!dock) return;
    dock.hidden = true;
    chipBtn?.classList.remove('is-hidden');
    chipBtn?.setAttribute('aria-expanded','false');
    if (lastTriggerEl && typeof lastTriggerEl.focus === 'function') {
      lastTriggerEl.focus();
    }
  }

  const onChipClick = (e)=>{ e.preventDefault(); e.stopPropagation(); lastTriggerEl = e.currentTarget; openDock(); };

  chipBtn?.addEventListener('click', onChipClick);



  const onCloseClick = (e)=>{ e.preventDefault(); closeDock(); };

  close?.addEventListener('click', onCloseClick);



  // ESC closes the dock from anywhere

  const onDocKeyDown = (e)=>{

    if (e.key === 'Escape' && !dock?.hidden) {

      e.preventDefault();

      closeDock();

    }

  };

  document.addEventListener('keydown', onDocKeyDown);



  // Click-outside closes the dock

  const onDocClick = (e)=>{

    if (!dock?.hidden && dock && !dock.contains(e.target) && e.target !== chipBtn) {

      closeDock();

    }

  };

  document.addEventListener('click', onDocClick);






  function mdSafe(text){
    if (text == null) return '';
    return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function mdToHtml(md){
    let t = mdSafe(md);
    t = t.replace(/```([\s\S]*?)```/g, (_,c)=> `<pre><code>${c}</code></pre>`);
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    if (/^- .+/m.test(t)){
      t = t.replace(/(?:^|\n)-(.*?)(?=\n(?!- )|$)/gs, m=>{
        const items = m.trim().split('\n').map(s=>s.replace(/^- /,'').trim());
        return `<ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul>`;
      });
    }
    t = t.replace(/\*\*([^*]+)\*\*:/g, '<h4>$1<\/h4>');
    t = t.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1<\/a>');
    t = t.split(/\n{2,}/).map(p=>`<p>${p.trim()}<\/p>`).join('');
    return t;
  }

  function avatarEl(type){
    const el = document.createElement('div');
    el.className = 'avatar';
    const src = type === 'ai' ? AVATARS.ai : AVATARS.user;
    if (src){ el.style.background = `center/cover no-repeat url("${src}")`; el.textContent=''; }
    else { el.textContent = type === 'ai' ? 'AI' : 'L'; }
    return el;
  }

  let idSeq = 0;
  function appendMessage(role, content='', {served_by, streaming=false}={}){
    const id = `m${++idSeq}`;
    const li = document.createElement('li');
    li.className = `msg ${role === 'user' ? 'from-user' : 'from-ai'}`;
    li.dataset.id = id;
    const avatar = avatarEl(role === 'user' ? 'user' : 'ai');
    const bubble = document.createElement('div');
    bubble.className = 'bubble markdown';
    bubble.innerHTML = mdToHtml(content) + (streaming ? `<span class=\"cursor\"></span>` : '');

    if (role !== 'user' && served_by){
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--lk-accent') || '#2d6cdf';
      bubble.insertAdjacentHTML('afterbegin', `<div style=\"opacity:.75; font-size:12px; margin-bottom:.25rem; color:${accent}\">served by <strong>${served_by}</strong></div>`);
      if (servedBySpan) servedBySpan.textContent = served_by;
    }

    if (role === 'user'){ li.append(bubble, avatar); } else { li.append(avatar, bubble); }
    log.append(li); log.scrollTop = log.scrollHeight;
    return { id, el: li, bubble };
  }

  function streamAppend(id, chunk){
    const li = log.querySelector(`[data-id="${id}"]`); if (!li) return;
    const b = li.querySelector('.bubble');
    const cursor = b.querySelector('.cursor'); if (cursor) cursor.remove();
    b.innerHTML += mdToHtml(chunk) + `<span class=\"cursor\"></span>`;
    log.scrollTop = log.scrollHeight;
  }
  function streamDone(id){
    const li = log.querySelector(`[data-id="${id}"]`); if (!li) return;
    const cursor = li.querySelector('.cursor'); if (cursor) cursor.remove();
  }

  // --- SSE helper utilities -------------------------------------------------
  function delay(ms){ return new Promise(r=> setTimeout(r, ms)); }

  function parseSSEBuffer(buffer){
    // Returns { events: Array<{event,data}>, remainder }
    const parts = buffer.split('\n\n');
    const remainder = parts.pop() ?? '';
    const out = [];
    for (const block of parts){
      const lines = block.split('\n');
      const evLine = lines.find(l=> l.startsWith('event:'));
      const dataLine = lines.find(l=> l.startsWith('data:'));
      if (!dataLine) continue;
      const event = evLine ? evLine.slice(6).trim() : 'message';
      try {
        const data = JSON.parse(dataLine.slice(5));
        out.push({ event, data });
      } catch { /* skip malformed */ }
    }
    return { events: out, remainder };
  }

  async function streamChatOnce(payload, {onMeta, onChunk, onDone, signal}){
    const resp = await fetch(API_STREAM, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload),
      signal
    });
    if (!resp.ok || !resp.body) throw new Error('bad_stream_response');
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastActivity = Date.now();
    const inactivityTimer = setInterval(()=>{
      if (Date.now() - lastActivity > STREAM_INACTIVITY_TIMEOUT_MS){
        try { reader.cancel(); } catch{}
      }
    }, 1000);
    try {
      while(true){
        const { done, value } = await reader.read();
        if (done) break;
        lastActivity = Date.now();
        buffer += decoder.decode(value, { stream:true });
        const { events, remainder } = parseSSEBuffer(buffer);
        buffer = remainder;
        for (const ev of events){
          if (ev.event === 'meta' && ev.data?._served_by) onMeta?.(ev.data);
          else if (ev.event === 'done'){ onDone?.(); return; }
          else {
            const chunk = ev.data?.choices?.[0]?.delta?.content ?? ev.data?.content ?? '';
            if (chunk) onChunk?.(chunk);
          }
        }
      }
      onDone?.();
    } finally {
      clearInterval(inactivityTimer);
    }
  }

  async function streamWithRetry(basePayload, handlers){
    const start = Date.now();
    for (let attempt=0; attempt <= STREAM_MAX_RETRIES; attempt++){
      const controller = new AbortController();
      const tOverall = setTimeout(()=> controller.abort(), STREAM_OVERALL_TIMEOUT_MS - (Date.now()-start));
      try {
        await streamChatOnce(basePayload, { ...handlers, signal: controller.signal });
        return true; // success
      } catch (err){
        if (controller.signal.aborted) break;
        if (attempt === STREAM_MAX_RETRIES) return false;
        const backoff = STREAM_RETRY_BASE_MS * (2 ** attempt) + Math.random()*STREAM_RETRY_JITTER_MS;
        await delay(backoff);
        continue;
      } finally { clearTimeout(tOverall); }
    }
    return false;
  }

  // ---------------------------------------------------------------------------

  form?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const q = input.value.trim(); if (!q) return;
    appendMessage('user', q);
    input.value = '';
    // Return focus to input for rapid follow-ups
    requestAnimationFrame(()=> input?.focus());

  const ai = appendMessage('assistant', '', { streaming:true });
    const ensureFocus = () => requestAnimationFrame(()=> input?.focus());
    const accentColor = () => getComputedStyle(document.documentElement).getPropertyValue('--lk-accent') || '#2d6cdf';

    const fallbackNonStream = async () => {
      try{
        const r = await fetch(API_CHAT, {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ messages: [{ role:'user', content: q }] })
        });
        if (!r.ok){
          throw new Error(`fallback http ${r.status}`);
        }
        const payload = await r.json();
        const servedBy = payload?._served_by || 'unknown';
        const accent = accentColor();
        ai.bubble.innerHTML = '';
        ai.bubble.insertAdjacentHTML('afterbegin', `<div style="opacity:.75; font-size:12px; margin-bottom:.25rem; color:${accent}">served by <strong>${servedBy}</strong></div>`);
        if (servedBySpan) servedBySpan.textContent = servedBy;
        window.AgentStatus?.updateServed(servedBy);
        const message = payload?.choices?.[0]?.message?.content ?? payload?.message ?? payload?.content ?? '';
        if (message){
          ai.bubble.insertAdjacentHTML('beforeend', mdToHtml(message));
        } else {
          ai.bubble.insertAdjacentHTML('beforeend', '<p><em>No response received.</em></p>');
        }
      } catch {
        ai.bubble.innerHTML = '<p><em>Connection issue. Please try again.</em></p>';
      } finally {
        streamDone(ai.id);
        ensureFocus();
      }
    };

    const succeeded = await streamWithRetry(
      { messages: [{ role:'user', content: q }], stream: true },
      {
        onMeta(meta){
          ai.bubble.querySelector('div')?.remove();
          const accent = accentColor();
          ai.bubble.insertAdjacentHTML('afterbegin', `<div style="opacity:.75; font-size:12px; margin-bottom:.25rem; color:${accent}">served by <strong>${meta._served_by}</strong></div>`);
          if (servedBySpan) servedBySpan.textContent = meta._served_by;
          window.AgentStatus?.updateServed(meta._served_by);
        },
        onChunk(chunk){ streamAppend(ai.id, chunk); },
        onDone(){ streamDone(ai.id); ensureFocus(); }
      }
    );
    if (!succeeded){
      await fallbackNonStream();
    }

  });

  // Register cleanup for HMR and page lifecycle
  __assistantCleanup = () => {

    try {

      document.removeEventListener('click', onDocClick);

      document.removeEventListener('keydown', onDocKeyDown);

      if (chipBtn) chipBtn.removeEventListener('click', onChipClick);

      if (close) close.removeEventListener('click', onCloseClick);

      // Remove event listeners by cloning nodes (cheap and safe)

      if (form && form.parentNode) { const f=form.cloneNode(true); form.parentNode.replaceChild(f, form); }

      if (close && close.parentNode) { const c=close.cloneNode(true); close.parentNode.replaceChild(c, close); }

      if (dock && dock.parentNode) { /* keep current instance */ }

    } catch {}

  };
})();











