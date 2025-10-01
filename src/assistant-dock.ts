// assistant-dock.ts - stream-capable assistant UI (TypeScript)
import { API, chat, streamChat, ChatMessage } from './api';

declare global { interface Window { __assistantDockMounted?: boolean; AgentStatus?: any } }

if (window.__assistantDockMounted) {
  document.querySelectorAll('.assistant-dock').forEach((el, i) => { if (i > 0) el.remove(); });
  console.warn('[assistant] duplicate mount prevented');
} else {
  window.__assistantDockMounted = true;

  const root = (document.getElementById('assistantDock') || document.querySelector('.assistant-dock')) as HTMLElement | null;
  const chipBtn = document.getElementById('assistantChip');
  const closeBtn = root?.querySelector('.assistant-close') as HTMLElement | null;
  const log = root?.querySelector('.chat-log') as HTMLElement | null;
  const form = root?.querySelector('.chat-composer') as HTMLFormElement | null;
  const input = root?.querySelector('input[name="q"], #chatInput') as HTMLInputElement | null;
  const servedBySpan = root?.querySelector('.served-by, #servedBy') as HTMLElement | null;

  try{ if (servedBySpan) servedBySpan.style.color = getComputedStyle(document.documentElement).getPropertyValue('--lk-muted') || '#b4c0cf'; } catch {}
  const API_STREAM = (API?.base || (window as any).AGENT_BASE_URL || 'http://127.0.0.1:8001') + '/chat/stream';
  const API_CHAT   = (API?.base || (window as any).AGENT_BASE_URL || 'http://127.0.0.1:8001') + '/chat';

  const STREAM_MAX_RETRIES = 2;
  const STREAM_RETRY_BASE_MS = 500;
  const STREAM_RETRY_JITTER_MS = 250;
  const STREAM_OVERALL_TIMEOUT_MS = 45_000;
  const STREAM_INACTIVITY_TIMEOUT_MS = 8_000;
  let lastTriggerEl: any = null;

  function openDock(){ if (!root) return; root.hidden = false; chipBtn?.classList.add('is-hidden'); chipBtn?.setAttribute('aria-expanded','true'); requestAnimationFrame(()=> input?.focus()); }
  function closeDock(){ if (!root) return; root.hidden = true; chipBtn?.classList.remove('is-hidden'); chipBtn?.setAttribute('aria-expanded','false'); lastTriggerEl?.focus?.(); }
  const onChipClick = (e: Event)=>{ e.preventDefault(); lastTriggerEl = e.currentTarget; openDock(); };
  chipBtn?.addEventListener('click', onChipClick);
  const onCloseClick = (e: Event)=>{ e.preventDefault(); closeDock(); };
  closeBtn?.addEventListener('click', onCloseClick);
  const onDocKeyDown = (e: KeyboardEvent)=>{ if (e.key === 'Escape' && !root?.hidden){ e.preventDefault(); closeDock(); } };
  document.addEventListener('keydown', onDocKeyDown);
  const onDocClick = (e: MouseEvent)=>{ if (!root?.hidden && root && !root.contains(e.target as Node) && e.target !== chipBtn) closeDock(); };
  document.addEventListener('click', onDocClick);

  function mdSafe(text: string){ return String(text ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function mdToHtml(md: string){
    let t = mdSafe(md);
    t = t.replace(/```([\s\S]*?)```/g, (_,c)=> `<pre><code>${c}</code></pre>`)
         .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
         .replace(/\*([^*]+)\*/g, '<em>$1</em>')
         .replace(/\*\*([^*]+)\*\*:/g, '<h4>$1</h4>')
         .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    if (/^- .+/m.test(t)) {
      t = t.replace(/(?:^|\n)-(.*?)(?=\n(?!- )|$)/gs, m => {
        const items = m.trim().split('\n').map(s=>s.replace(/^- /,'').trim());
        return `<ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul>`;
      });
    }
    t = t.split(/\n{2,}/).map(p=>`<p>${p.trim()}</p>`).join('');
    return t;
  }
  function avatarEl(type: 'ai'|'user'){
    const el = document.createElement('div'); el.className = 'avatar';
    if (type === 'ai') { el.textContent=''; } else { el.textContent='L'; }
    return el;
  }
  let idSeq = 0;
  function appendMessage(role: 'user'|'assistant', content='', { served_by, streaming=false }: { served_by?: string; streaming?: boolean } = {}){
    if (!log) return { id:'-', el:null, bubble:null } as any;
    const id = `m${++idSeq}`;
    const li = document.createElement('li');
    li.className = `msg ${role === 'user' ? 'from-user' : 'from-ai'}`;
    li.dataset.id = id;
    const avatar = avatarEl(role === 'user' ? 'user' : 'ai');
    const bubble = document.createElement('div');
    bubble.className = 'bubble markdown';
    bubble.innerHTML = mdToHtml(content) + (streaming ? '<span class="cursor"></span>' : '');
    if (role !== 'user' && served_by) {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--lk-accent') || '#2d6cdf';
      bubble.insertAdjacentHTML('afterbegin', `<div style="opacity:.75; font-size:12px; margin-bottom:.25rem; color:${accent}">served by <strong>${served_by}</strong></div>`);
      if (servedBySpan) servedBySpan.textContent = served_by;
    }
    if (role === 'user') { li.append(bubble, avatar); } else { li.append(avatar, bubble); }
    log.append(li); log.scrollTop = log.scrollHeight;
    return { id, el: li, bubble };
  }
  function streamAppend(id: string, chunk: string){ if (!log) return; const li = log.querySelector(`[data-id="${id}"]`); if (!li) return; const b = li.querySelector('.bubble') as HTMLElement; const cursor = b.querySelector('.cursor'); cursor?.remove(); b.innerHTML += mdToHtml(chunk) + '<span class="cursor"></span>'; log.scrollTop = log.scrollHeight; }
  function streamDone(id: string){ if (!log) return; const li = log.querySelector(`[data-id="${id}"]`); if (!li) return; li.querySelector('.cursor')?.remove(); }

  function delay(ms: number){ return new Promise(r=> setTimeout(r, ms)); }
  function parseSSEBuffer(buffer: string){
    const parts = buffer.split('\n\n');
    const remainder = parts.pop() ?? '';
    const out: { event:string; data:any }[] = [];
    for (const block of parts){
      const lines = block.split('\n');
      const evLine = lines.find(l=> l.startsWith('event:'));
      const dataLine = lines.find(l=> l.startsWith('data:'));
      if (!dataLine) continue;
      const event = evLine ? evLine.slice(6).trim() : 'message';
      try { const data = JSON.parse(dataLine.slice(5)); out.push({ event, data }); } catch {}
    }
    return { events: out, remainder };
  }

  async function streamChatOnce(payload: any, { onMeta, onChunk, onDone, signal }: any){
    const resp = await (API?.streamChat ? API.streamChat(payload.messages, { signal }) : fetch(API_STREAM, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload), signal }));
    if (!(resp instanceof Response) || !resp.ok || !resp.body) throw new Error('bad_stream_response');
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = ''; let lastActivity = Date.now();
    const inactivityTimer = setInterval(()=>{ if (Date.now() - lastActivity > STREAM_INACTIVITY_TIMEOUT_MS){ try { reader.cancel(); } catch{} } }, 1000);
    try {
      while (true){
        const { done, value } = await reader.read();
        if (done) break;
        lastActivity = Date.now();
        buffer += decoder.decode(value, { stream:true });
        const { events, remainder } = parseSSEBuffer(buffer); buffer = remainder;
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
    } finally { clearInterval(inactivityTimer); }
  }

  async function streamWithRetry(basePayload: any, handlers: any){
    const start = Date.now();
    for (let attempt=0; attempt <= STREAM_MAX_RETRIES; attempt++){
      const controller = new AbortController();
      const timeLeft = STREAM_OVERALL_TIMEOUT_MS - (Date.now() - start);
      const tOverall = setTimeout(()=> controller.abort(), Math.max(0, timeLeft));
      try {
        await streamChatOnce(basePayload, { ...handlers, signal: controller.signal });
        return true;
      } catch {
        if (controller.signal.aborted) break;
        if (attempt === STREAM_MAX_RETRIES) return false;
        const backoff = STREAM_RETRY_BASE_MS * (2 ** attempt) + Math.random() * STREAM_RETRY_JITTER_MS;
        await delay(backoff);
        continue;
      } finally { clearTimeout(tOverall); }
    }
    return false;
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!input) return;
    const q = input.value.trim(); if (!q) return;
    appendMessage('user', q);
    input.value = '';
    requestAnimationFrame(()=> input?.focus());
    const ai = appendMessage('assistant', '', { streaming:true });
    const ensureFocus = () => requestAnimationFrame(()=> input?.focus());
    const accentColor = () => getComputedStyle(document.documentElement).getPropertyValue('--lk-accent') || '#2d6cdf';
    const fallbackNonStream = async () => {
      try {
        const resp: any = API?.chat ? await API.chat([{ role:'user', content: q }]) : await fetch(API_CHAT, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ messages:[{ role:'user', content: q }] }) }).then(r=> r.json());
        const servedBy = resp?._served_by || 'unknown';
        const accent = accentColor();
        if (ai.bubble) {
          ai.bubble.innerHTML = '';
          ai.bubble.insertAdjacentHTML('afterbegin', `<div style="opacity:.75; font-size:12px; margin-bottom:.25rem; color:${accent}">served by <strong>${servedBy}</strong></div>`);
          if (servedBySpan) servedBySpan.textContent = servedBy;
          window.AgentStatus?.updateServed(servedBy);
          const message = resp?.choices?.[0]?.message?.content ?? resp?.message ?? resp?.content ?? '';
          ai.bubble.insertAdjacentHTML('beforeend', message ? mdToHtml(message) : '<p><em>No response received.</em></p>');
        }
      } catch {
        if (ai.bubble) {
          ai.bubble.innerHTML = '<p><em>Connection issue. Please try again.</em></p>';
        }
      } finally { streamDone(ai.id); ensureFocus(); }
    };
    const succeeded = await streamWithRetry(
      { messages: [{ role:'user', content: q }], stream: true },
      {
        onMeta(meta: any){
          if (ai.bubble) {
            const firstDiv = ai.bubble.querySelector('div');
            if (firstDiv) firstDiv.remove();
          }
          const accent = accentColor();
            ai.bubble?.insertAdjacentHTML('afterbegin', `<div style="opacity:.75; font-size:12px; margin-bottom:.25rem; color:${accent}">served by <strong>${meta._served_by}</strong></div>`);
          if (servedBySpan) servedBySpan.textContent = meta._served_by;
          window.AgentStatus?.updateServed(meta._served_by);
        },
        onChunk(chunk: string){ streamAppend(ai.id, chunk); },
        onDone(){ streamDone(ai.id); ensureFocus(); }
      }
    );
    if (!succeeded) await fallbackNonStream();
  });
  /* lint: end of module closure */
}

// Provide a harmless exported const to ensure module context without stray expression
export const __assistantDockModule = true;
