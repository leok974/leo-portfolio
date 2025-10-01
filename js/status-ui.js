// status-ui.js - status pill polling for readiness / warming state
// Leverages nginx warming interceptor and backend summary endpoint.
(function(){
  /** @type {HTMLElement | null} */
  const pill = document.querySelector('[data-status-pill]');
  if(!pill) return;

  // Derive API base similar to api.js (but lightweight and synchronous)
  const isPages = typeof location !== 'undefined' && location.hostname.endsWith('github.io');
  const API_BASE = (/** @type {any} */(window)).__API_BASE__ ? (/** @type {any} */(window)).__API_BASE__ : (isPages ? 'https://assistant.ledger-mind.org/api' : '/api');
  const API_BASE_CLEAN = API_BASE.replace(/\/$/, '');

  /**
   * @param {string} text
   * @param {string} cls
   */
  function set(text, cls){
    if (!pill) return;
    pill.textContent = text;
    pill.className = 'badge ' + cls;
  }

  let interval = 8000; // default poll cadence
  let failures = 0;

  async function tick(){
    const ctrl = new AbortController();
    const to = setTimeout(()=>ctrl.abort(), 6000);
    try {
  const res = await fetch(`${API_BASE_CLEAN}/status/summary`, { cache:'no-store', signal: ctrl.signal });
      clearTimeout(to);
      if(!res.ok) throw new Error('HTTP ' + res.status);
      const s = await res.json();
      const ready = !!s?.ready;
      const path = s?.llm?.path || 'unknown';
      if(ready){
        set('Ready','badge-ok');
        failures = 0;
        interval = 10000; // slow down when healthy
      } else if(path === 'warming') {
        set('Warming model…','badge-warn');
        interval = 8000;
      } else if(path === 'fallback') {
        set('Degraded (fallback)','badge-degraded');
        interval = 8000;
      } else {
        set('Starting…','badge-neutral');
        interval = 8000;
      }
  } catch (_err){
      clearTimeout(to);
      failures++;
      interval = Math.min(30000, 5000 * Math.pow(1.4, failures));
      set('Connecting…','badge-neutral');
    } finally {
      setTimeout(tick, interval);
    }
  }
  tick();
})();
