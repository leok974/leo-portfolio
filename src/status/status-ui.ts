// status-ui.ts - status pill polling (migrated to TS)
// Provides typed, tree-shakeable readiness indicator logic.

interface SummaryLLMInfo { path?: string; }
interface StatusSummary { ready?: boolean; llm?: SummaryLLMInfo; }

type BadgeState = 'badge-ok' | 'badge-warn' | 'badge-degraded' | 'badge-neutral';

const PILL_SELECTOR = '[data-status-pill]';

function deriveApiBase(): string {
  const isPages = typeof location !== 'undefined' && location.hostname.endsWith('github.io');
  const candidate = (globalThis as any).__API_BASE__ || (isPages ? 'https://assistant.ledger-mind.org/api' : '/api');
  return String(candidate).replace(/\/$/, '');
}

function mount() {
  const pill = document.querySelector<HTMLSpanElement>(PILL_SELECTOR);
  if (!pill) return; // Nothing to do if pill missing.

  const API_BASE = deriveApiBase();

  const set = (text: string, cls: BadgeState) => {
    pill.textContent = text;
    pill.className = `badge ${cls}`;
  };

  let interval = 8000; // ms
  let failures = 0;

  async function tick() {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000);
    try {
      let url = `${API_BASE}/status/summary`;
      let res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
      if (!res.ok && location.hostname.endsWith('github.io')) {
        // Try legacy path if server hasn't been updated or DNS still pointing old edge
        const legacyUrl = url.replace('/api/status/summary', '/status/summary');
        try {
          const legacy = await fetch(legacyUrl, { cache: 'no-store', signal: ctrl.signal });
          if (legacy.ok) res = legacy;
        } catch {}
      }
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const s = (await res.json()) as StatusSummary;
      const ready = !!s?.ready;
      const path = s?.llm?.path || 'unknown';
      if (ready) {
        set('Ready', 'badge-ok');
        failures = 0;
        interval = 10000;
      } else if (path === 'warming') {
        set('Warming model…', 'badge-warn');
        interval = 8000;
      } else if (path === 'fallback') {
        set('Degraded (fallback)', 'badge-degraded');
        interval = 8000;
      } else {
        set('Starting…', 'badge-neutral');
        interval = 8000;
      }
    } catch (err) {
      clearTimeout(timeout);
      failures += 1;
      interval = Math.min(30000, 5000 * Math.pow(1.4, failures));
      set('Connecting…', 'badge-neutral');
    } finally {
      setTimeout(tick, interval);
    }
  }

  tick();
}

// Defer until DOM ready if necessary
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
