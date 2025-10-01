// Extracted from former inline <script> in index.html
// Provides streaming chat functionality and exposes window.startStream

interface ChatMessage { role: string; content: string }
interface StreamOptions { logEl?: HTMLElement }

(function initChat(){
  const ENABLE_ASSISTANT = ['leok974.github.io','localhost','127.0.0.1'].includes(location.hostname);
  if (!ENABLE_ASSISTANT) return;
  const isLocal = ['localhost','127.0.0.1'].includes(location.hostname);
  const API_BASE = isLocal ? 'http://127.0.0.1:8001' : 'https://assistant.ledger-mind.org';
  window.AGENT_BASE_URL = API_BASE; // used by status module
  const API_STREAM = API_BASE + '/chat/stream';
  const API_NON_STREAM = API_BASE + '/chat';

  const CLIENT_SYSTEM: ChatMessage = {
    role: 'system',
    content: "You are Leo’s portfolio assistant. Return one best project with a short value line + 3 bullets (Tech, Impact, Why hireable). Close with [Case Study] • [GitHub] • [Schedule]. If unclear, ask one brief clarifying question first."
  };
  const msgs: ChatMessage[] = [];
  const context: Record<string, any> = {};

  // Prime tiny context
  (async ()=> {
    try {
      const res = await fetch('projects.json', { cache: 'no-store' });
      const data = await res.json();
      const take = (data.projects||[]).slice(0,6)
        .map((p: any)=>`• ${p.title}: ${p.description} [${(p.tags||[]).join(', ')}]`).join('\n');
      context.summary = `Projects:\n${take}`;
    } catch {}
  })();

  function appendLine(el: HTMLElement, role: string, text: string){
    const div = document.createElement('div');
    div.className = 'msg ' + (role === 'user' ? 'you':'ai');
    div.textContent = (role==='user'?'You: ':'Assistant: ') + text;
    el.appendChild(div); el.scrollTop = el.scrollHeight;
  }

  async function doStream(question: string, logEl: HTMLElement){
    msgs.push({ role:'user', content: question });
    appendLine(logEl, 'user', question);
    appendLine(logEl, 'assistant', 'Thinking…');
    try {
      const res = await fetch(API_STREAM, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ messages: [CLIENT_SYSTEM, ...msgs], context, stream: true }) });
      if (!res.ok || !res.body) throw new Error('stream failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder(); let buf=''; let ans='';
      while(true){
        const {value, done} = await reader.read(); if (done) break;
        buf += decoder.decode(value, {stream:true});
        let i; while((i = buf.indexOf('\n\n')) !== -1){
          const chunk = buf.slice(0,i); buf = buf.slice(i+2);
          for (const line of chunk.split('\n')){
            const l = line.trim(); if (!l.startsWith('data:')) continue;
            const data = l.slice(5).trim(); if (data === '[DONE]') return;
            try {
              if (chunk.startsWith('event: meta')){
                const meta = JSON.parse(data);
                const servedBy = meta._served_by;
                window.AgentStatus?.updateServed(servedBy);
                continue;
              }
              const j = JSON.parse(data);
              const d = j.choices?.[0]?.delta?.content || '';
              if (d){ ans += d; const last = logEl.lastChild as HTMLElement | null; if (last) last.textContent = 'Assistant: ' + ans; logEl.scrollTop = logEl.scrollHeight; }
            } catch {}
          }
        }
      }
    } catch {
      try {
        const res = await fetch(API_NON_STREAM, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ messages: [CLIENT_SYSTEM, ...msgs], context }) });
        const data = await res.json();
        const text = data.assistant || '(no response)';
        const last = logEl.lastChild as HTMLElement | null; if (last) last.textContent = 'Assistant: ' + text;
      } catch {
        const last = logEl.lastChild as HTMLElement | null; if (last) last.textContent = 'Assistant: (connection failed — please try again later)';
      }
    }
  }

  window.startStream = (question: string, opts?: StreamOptions) => {
    const logEl = (opts?.logEl || document.getElementById('assistant-log')) as HTMLElement | null;
    if (!logEl) return;
    return doStream(question, logEl);
  };
})();
