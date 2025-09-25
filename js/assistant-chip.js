// assistant-chip.js
// Idempotent mount; safe DOM creation; no document.write
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

    // Build wrap
    const wrap = document.createElement('div');
    wrap.id = 'assistant-chip';
    wrap.style.cssText = [
      'position:fixed',
      'right: max(16px, env(safe-area-inset-right))',
      'bottom: max(16px, env(safe-area-inset-bottom))',
      'z-index:2147483642',
      'pointer-events:auto'
    ].join(';');

    wrap.innerHTML = `
      <button id="chip-btn" class="chip" aria-label="Ask about my projects">🤖 Ask about my projects…</button>
      <div id="chip-panel" class="panel" hidden role="dialog" aria-modal="false" aria-label="Assistant panel">
        <form id="chip-form" class="row" autocomplete="off">
          <input id="chip-input" placeholder="Which project fits GKE ops?" required />
          <button type="submit">Send</button>
        </form>
        <div id="chip-log" aria-live="polite"></div>
      </div>`;

    host.appendChild(wrap);

    // Wire up toggle
    const btn   = wrap.querySelector('#chip-btn');
    const panel = wrap.querySelector('#chip-panel');
    const form  = wrap.querySelector('#chip-form');
    const input = wrap.querySelector('#chip-input');
    const logEl = wrap.querySelector('#chip-log');

    const open = ()=>{ panel.hidden = false; input?.focus(); };
    const close= ()=>{ panel.hidden = true; };

    btn.addEventListener('click', ()=> panel.hidden ? open() : close());

    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape' && !panel.hidden) close();
    });

    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      if (typeof window.startStream === 'function') {
        window.startStream(q, { logEl });
      }
      input.value = '';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountChip);
  else mountChip();
})();
