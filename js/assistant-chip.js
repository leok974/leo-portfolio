// assistant-chip.js
// Idempotent mount; safe DOM creation; unified panel using site styles/IDs
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
          <span data-agent-badge title="LLM source">local</span>
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountChip);
  else mountChip();
})();
