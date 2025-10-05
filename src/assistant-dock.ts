// assistant-dock.ts - stream-capable assistant UI (TypeScript)
import { API } from './api';
import { readSSE } from './lib/sse';
import { renderRouteBadge } from './components/render-badge';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { ShieldBadge } from '@/components/badges/ShieldBadge';
import { mountAdminRebuildFloating } from '@/components/render-admin';

declare global { interface Window { __assistantDockMounted?: boolean; __creatingSourcesPopover?: boolean; __sourcesListenersBound?: boolean; __sourcesObserverBound?: boolean; AgentStatus?: any } }

if (window.__assistantDockMounted) {
  document.querySelectorAll('.assistant-dock').forEach((el, i) => { if (i > 0) el.remove(); });
  console.warn('[assistant] duplicate mount prevented');
} else {
  window.__assistantDockMounted = true;
  try {
    document.querySelectorAll('[data-testid="assistant-sources-popover"]').forEach((el) => el.remove());
  } catch {}

  const root = (document.getElementById('assistantDock') || document.querySelector('.assistant-dock')) as HTMLElement | null;
  const chipBtn = document.getElementById('assistantChip');
  const closeBtn = root?.querySelector('.assistant-close') as HTMLElement | null;
  const log = root?.querySelector('.chat-log') as HTMLElement | null;
  const form = root?.querySelector('.chat-composer') as HTMLFormElement | null;
  const input = root?.querySelector('input[name="q"], #chatInput') as HTMLInputElement | null;
  try { input?.setAttribute('data-testid','assistant-input'); } catch {}
  const servedBySpan = root?.querySelector('.served-by, #servedBy') as HTMLElement | null;
  const assistantOutput = root?.querySelector('[data-testid="assistant-output"]') as HTMLElement | null;

  try {
    if (servedBySpan) {
      servedBySpan.classList.add('text-muted');
    }
  } catch {}
  const CHAT_STREAM_URL = '/chat/stream';
  const CHAT_URL = '/chat';

  const STREAM_MAX_RETRIES = 2;
  const STREAM_RETRY_BASE_MS = 500;
  const STREAM_RETRY_JITTER_MS = 250;
  const STREAM_OVERALL_TIMEOUT_MS = 45_000;
  let lastTriggerEl: any = null;

  function openDock(){ if (!root) return; root.hidden = false; chipBtn?.classList.add('is-hidden'); chipBtn?.setAttribute('aria-expanded','true'); requestAnimationFrame(()=> input?.focus()); }
  function closeDock(){ if (!root) return; root.hidden = true; chipBtn?.classList.remove('is-hidden'); chipBtn?.setAttribute('aria-expanded','false'); lastTriggerEl?.focus?.(); }
  try {
    const chip = document.getElementById('assistantChip') as HTMLElement | null;
    if (chip) {
      chip.classList.add('fixed');
      chip.style.position = 'fixed';
      chip.style.right = chip.style.right || '16px';
      chip.style.bottom = chip.style.bottom || '16px';
      chip.style.zIndex = '10000'; // above admin dock (9998)
      chip.style.pointerEvents = 'auto';
    }
  } catch {}
  const onChipClick = (e: Event)=>{ e.preventDefault(); lastTriggerEl = e.currentTarget; openDock(); };
  chipBtn?.addEventListener('click', onChipClick);
  const onCloseClick = (e: Event)=>{ e.preventDefault(); closeDock(); };
  closeBtn?.addEventListener('click', onCloseClick);
  const onDocKeyDown = (e: KeyboardEvent)=>{
    // If another handler (e.g., sources popover) already handled this event, do nothing
    if (e.defaultPrevented) return;
    // If sources popover is open, ESC should close it, not the entire dock
    if (__sourcesPopover && __sourcesPopover.getAttribute('data-open') === 'true') {
      return; // popover handler will take care of it
    }
    if (e.key === 'Escape' && !root?.hidden){ e.preventDefault(); closeDock(); }
  };
  document.addEventListener('keydown', onDocKeyDown);
  const onDocClick = (e: MouseEvent)=>{
    // If sources popover is open, don't close the entire dock here; the popover handler manages outside clicks.
    if (__sourcesPopover && __sourcesPopover.getAttribute('data-open') === 'true') return;
    if (!root?.hidden && root && !root.contains(e.target as Node) && e.target !== chipBtn) closeDock();
  };
  document.addEventListener('click', onDocClick);

  try {
    // Mount admin tools if enabled via Vite flag and not explicitly hidden (e2e may hide to avoid intercepting clicks)
    const ENABLE = (import.meta as any).env?.VITE_ENABLE_AGUI || '1';
    const HIDE = (window as any).__HIDE_ADMIN_DOCK__ ? '1' : '0';
    if (String(ENABLE) === '1' && HIDE !== '1') {
      // Pass through backend base derived in render-admin.tsx
      mountAdminRebuildFloating("");
    }
  } catch {}

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
  const streamState = new Map<string, { raw: string; servedBy?: string; grounded?: boolean; sourcesCount?: number }>();
  interface GroundingMeta { grounded?: boolean; sources?: Array<{ title?: string; id?: string; path?: string; url?: string }>; sources_count?: number; _served_by?: string }
  let __lastGroundingMeta: GroundingMeta | null = null;
  let __sourcesPopover: HTMLElement | null = null;
  let __badgeEl: HTMLElement | null = null;
  let __lastPopoverCloseTs = 0;
  let __justClosedPopoverByPointerDown = false;
  const accentColor = () => getComputedStyle(document.documentElement).getPropertyValue('--lk-accent') || '#2d6cdf';
  function getStreamState(id: string){
    let state = streamState.get(id);
    if (!state) {
      state = { raw: '' };
      streamState.set(id, state);
    }
    return state;
  }
  function renderStream(id: string, bubble: HTMLElement | null, streaming: boolean){
    if (!bubble) return;
    const state = streamState.get(id);
    if (!state) {
      if (!streaming) bubble.querySelector('.cursor')?.remove();
      return;
    }
    const badges: string[] = [];
    if (state.servedBy) badges.push(`served by <strong>${state.servedBy}</strong>`);
    if (state.grounded) {
      const n = typeof state.sourcesCount === 'number' ? state.sourcesCount : undefined;
      // Render an explicit badge span so tests and a11y can detect grounding state early
      const badgeClasses = [
        'assistant-badge',
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm',
        'bg-neutral-100 text-neutral-800 border-neutral-300',
        'dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700',
        'cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-400',
        'transition-colors'
      ].join(' ');
      badges.push(`<span data-testid="assistant-badge" class="${badgeClasses}" aria-live="polite">grounded${typeof n === 'number' ? ` (${n})` : ''}</span>`);
    }
    const servedMarkup = badges.length ? `<div class="served-by-line" data-accent="${accentColor()}">${badges.join(' · ')}</div>` : '';
    const cursor = streaming ? '<span class="cursor"></span>' : '';
    const contentHtml = state.raw ? mdToHtml(state.raw) : '';
    bubble.innerHTML = `${servedMarkup}${contentHtml}${cursor}`;
    // Wire up badge interactions if present
    attachBadgeInteractions(bubble);
  }
  function appendMessage(role: 'user'|'assistant', content='', { served_by, streaming=false }: { served_by?: string; streaming?: boolean } = {}){
    if (!log) return { id:'-', el:null, bubble:null } as any;
    const id = `m${++idSeq}`;
    const li = document.createElement('li');
    li.className = `msg ${role === 'user' ? 'from-user' : 'from-ai'}`;
    li.dataset.id = id;
    const avatar = avatarEl(role === 'user' ? 'user' : 'ai');
    const bubble = document.createElement('div');
    bubble.className = 'bubble markdown';
    if (role === 'assistant' && streaming) {
      const state = getStreamState(id);
      state.raw = content;
      state.servedBy = served_by;
      renderStream(id, bubble, true);
    } else {
      bubble.innerHTML = mdToHtml(content) + (streaming ? '<span class="cursor"></span>' : '');
      if (role !== 'user' && served_by) {
        bubble.insertAdjacentHTML('afterbegin', `<div class="served-by-line" data-accent="${accentColor()}">served by <strong>${served_by}</strong></div>`);
        if (servedBySpan) servedBySpan.textContent = served_by;
      }
      attachBadgeInteractions(bubble);
    }
    if (role === 'user') { li.append(bubble, avatar); } else { li.append(avatar, bubble); }
    log.append(li); log.scrollTop = log.scrollHeight;
    if (role === 'user' && assistantOutput) assistantOutput.textContent = '';
    if (role === 'assistant' && streaming && assistantOutput) assistantOutput.textContent = '';
    return { id, el: li, bubble };
  }
  function streamAppend(id: string, chunk: string){ if (!log) return; const li = log.querySelector(`[data-id="${id}"]`); if (!li) return; const b = li.querySelector('.bubble') as HTMLElement; const state = getStreamState(id); state.raw += chunk; renderStream(id, b, true); if (assistantOutput) assistantOutput.textContent = (assistantOutput.textContent || '') + chunk; log.scrollTop = log.scrollHeight; }
  function streamDone(id: string){
    if (!log) return;
    const li = log.querySelector(`[data-id="${id}"]`);
    if (!li) return;
    const b = li.querySelector('.bubble') as HTMLElement;
    // Capture state before clearing
    const state = streamState.get(id);
    renderStream(id, b, false);
    const cursor = b.querySelector('.cursor');
    cursor?.remove();
    try {
      // Ensure a route badge footer exists even if no meta was seen (defaults to chitchat)
      let footer = b.querySelector('.assistant-meta') as HTMLElement | null;
      if (!footer) {
        footer = document.createElement('div');
        footer.className = 'assistant-meta';
        footer.style.display = 'flex';
        footer.style.alignItems = 'center';
        footer.style.gap = '8px';
        footer.style.marginTop = '6px';
        b.appendChild(footer);
      }
      const scope = (window as any).lastScope || undefined;
      renderRouteBadge(footer, {
        grounded: !!(state?.grounded ?? __lastGroundingMeta?.grounded),
        sourcesCount: typeof state?.sourcesCount === 'number' ? state?.sourcesCount : (typeof __lastGroundingMeta?.sources_count === 'number' ? __lastGroundingMeta?.sources_count : undefined)
      });
      // Append thumbs feedback bar once per assistant message
      try {
        const exists = b.querySelector('[data-testid="assistant-feedback-bar"]');
        if (!exists) {
          const bar = document.createElement('div');
          bar.setAttribute('data-testid', 'assistant-feedback-bar');
          bar.className = 'mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300';
          bar.innerHTML = `
            <span class="mr-1">Feedback:</span>
            <button type="button" data-testid="thumbs-up" aria-label="Thumbs up" class="rounded border px-2 py-0.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/30">👍</button>
            <button type="button" data-testid="thumbs-down" aria-label="Needs work" class="rounded border px-2 py-0.5 hover:bg-rose-50 dark:hover:bg-rose-900/30">👎 Needs work</button>
            <span class="ml-2 text-xs" data-testid="feedback-msg" aria-live="polite"></span>
          `;
          b.appendChild(bar);
          const up = bar.querySelector('[data-testid="thumbs-up"]') as HTMLButtonElement | null;
          const down = bar.querySelector('[data-testid="thumbs-down"]') as HTMLButtonElement | null;
          const msg = bar.querySelector('[data-testid="feedback-msg"]') as HTMLElement | null;
          const getText = () => {
            try { return (b.textContent || '').trim(); } catch { return ''; }
          };
          const getLastUser = () => {
            try {
              const prev = b.closest('li')?.previousElementSibling as HTMLElement | null;
              const isUser = prev?.classList.contains('from-user');
              const txt = isUser ? (prev?.querySelector('.bubble')?.textContent || '') : '';
              return (txt || '').trim();
            } catch { return ''; }
          };
          const servedBy = () => {
            try { return (__lastGroundingMeta?._served_by || 'unknown'); } catch { return 'unknown'; }
          };
          const post = async (score: number, note?: string) => {
            if (msg) msg.textContent = 'Saving…';
            try {
              const body = {
                question: getLastUser(),
                answer: getText(),
                score,
                served_by: servedBy(),
                grounded: !!__lastGroundingMeta?.grounded,
                sources_count: typeof __lastGroundingMeta?.sources_count === 'number' ? __lastGroundingMeta?.sources_count : ((__lastGroundingMeta?.sources || []).length || 0),
                scope: (window as any).lastScope || undefined,
                route: ((window as any).lastScope && (window as any).lastScope.route) ?? null,
                note: typeof note === 'string' ? note : undefined,
              };
              const baseRoot = (typeof (window as any).__API_BASE__ === 'string' ? (window as any).__API_BASE__ : (location.origin || '')).replace(/\/$/, '').replace(/\/api$/, '');
              const resp = await fetch(`${baseRoot}/api/feedback`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
              const ok = resp.ok;
              if (ok) { if (msg) msg.textContent = score > 0 ? 'Thanks!' : 'Noted.'; }
              else { if (msg) msg.textContent = 'Could not save'; }
            } catch { if (msg) msg.textContent = 'Error'; }
          };
          up?.addEventListener('click', () => post(1));
          down?.addEventListener('click', () => {
            let note: string | undefined = undefined;
            try { note = window.prompt('Optional note for this reply?', '') || undefined; } catch {}
            post(-1, note);
          });
        }
      } catch {}
    } catch {}
    streamState.delete(id);
  }

  function cleanupSourcesPopovers(){
    try {
      const nodes = Array.from(document.querySelectorAll('[data-testid="assistant-sources-popover"]')) as HTMLElement[];
      if (nodes.length === 0) return;
      // Prefer the element with the canonical ID if present
      const prefer = (document.getElementById('assistant-sources-popover') as HTMLElement | null) || nodes[0];
      nodes.forEach((n) => { if (n !== prefer) n.remove(); });
      __sourcesPopover = prefer;
    } catch {}
  }
  // Global mutation observer to auto-deduplicate any stray popovers created by race conditions
  if (!window.__sourcesObserverBound) {
    window.__sourcesObserverBound = true;
    try {
      const observer = new MutationObserver(() => cleanupSourcesPopovers());
      observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch {}
  }

  function ensureSourcesPopover(){
    // Always consolidate to a single popover instance and prevent race creation
    cleanupSourcesPopovers();
    const byId = document.getElementById('assistant-sources-popover') as HTMLElement | null;
    if (byId) { __sourcesPopover = byId; return byId; }
    if (__sourcesPopover && document.body.contains(__sourcesPopover)) return __sourcesPopover;

    if (window.__creatingSourcesPopover) {
      // Another create is in-flight; reuse once available
      cleanupSourcesPopovers();
      return (document.getElementById('assistant-sources-popover') as HTMLElement | null) || __sourcesPopover;
    }
    window.__creatingSourcesPopover = true;
    try {
      const pop = document.createElement('div');
      // Assign sentinel early to avoid duplicate creations under rapid calls
      __sourcesPopover = pop;
      pop.id = 'assistant-sources-popover';
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-modal', 'false');
      pop.setAttribute('aria-labelledby', 'assistant-sources-title');
      pop.setAttribute('data-testid', 'assistant-sources-popover');
      pop.className = [
        'assistant-sources-popover',
        'fixed right-4 bottom-4 z-50',
        'hidden'
      ].join(' ');
      pop.innerHTML = `
        <div class="min-w-[280px] max-w-[360px] rounded-xl border shadow-xl bg-white text-neutral-900 border-black/10 dark:bg-neutral-900 dark:text-neutral-100 dark:border-white/10">
          <div class="flex items-center justify-between px-3 py-2 border-b border-black/10 dark:border-white/10">
            <strong id="assistant-sources-title" class="text-sm">Grounded sources</strong>
            <button type="button" class="text-lg leading-none p-1 rounded-md hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-400" aria-label="Close" data-testid="assistant-sources-close">×</button>
          </div>
          <ol class="list-decimal px-5 py-3 space-y-1 text-sm" data-testid="assistant-sources-list"></ol>
        </div>`;
      (document.querySelector('[data-testid="assistant-header"]') || root || document.body).appendChild(pop);
      // Initialize hidden state using both [hidden] and inline display for robust visibility checks
      pop.setAttribute('data-open', 'false');
      pop.setAttribute('aria-hidden', 'true');
      (pop as any).hidden = true;
      (pop as HTMLElement).style.display = 'none';
  const close = pop.querySelector<HTMLButtonElement>('[data-testid="assistant-sources-close"]');
  if (close) { close.onclick = () => toggleSourcesPopover(false); }
      cleanupSourcesPopovers();
      return __sourcesPopover as HTMLElement;
    } finally { window.__creatingSourcesPopover = false; }
  }

  function renderSourcesList(meta: GroundingMeta | null){
    if (!__sourcesPopover) return;
    const list = __sourcesPopover.querySelector('[data-testid="assistant-sources-list"]') as HTMLOListElement;
    list.innerHTML = '';
    const src = meta?.sources || [];
    const MAX = 5;
    src.slice(0, MAX).forEach((s, i) => {
      const li = document.createElement('li');
      const title = s.title || s.id || `Source ${i+1}`;
      const path = s.path ? ` — ${s.path}` : '';
      if (s.url) {
        const a = document.createElement('a');
        a.href = s.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.className = 'text-blue-600 hover:underline dark:text-blue-400';
        a.textContent = `${title}${path}`;
        a.setAttribute('data-testid', 'assistant-source-link');
        li.appendChild(a);
      } else {
        li.textContent = `${title}${path}`;
      }
      list.appendChild(li);
    });
    if (src.length > MAX) {
      const more = document.createElement('li');
      more.textContent = `… and ${src.length - MAX} more`;
      list.appendChild(more);
    }
  }

  function toggleSourcesPopover(open: boolean){
    ensureSourcesPopover();
    cleanupSourcesPopovers();
    if (!__sourcesPopover) return;
    if (open && !__badgeEl) return;
    if (open) {
      // Hide any stray instances and ensure only one remains visible
      const nodes = Array.from(document.querySelectorAll('[data-testid="assistant-sources-popover"]')) as HTMLElement[];
      nodes.forEach((n) => {
        n.classList.add('hidden');
        n.setAttribute('data-open','false');
        n.setAttribute('aria-hidden', 'true');
        (n as any).hidden = true;
        (n as HTMLElement).style.display = 'none';
      });
      const node = (document.getElementById('assistant-sources-popover') as HTMLElement | null) || __sourcesPopover;
      if (node) {
        node.classList.remove('hidden');
        node.setAttribute('data-open', 'true');
        node.removeAttribute('aria-hidden');
        (node as any).hidden = false;
        (node as HTMLElement).style.display = 'block';
        __sourcesPopover = node;
      }
      cleanupSourcesPopovers();
      __badgeEl?.setAttribute('aria-expanded', 'true');
      renderSourcesList(__lastGroundingMeta);
      const closeBtn = __sourcesPopover.querySelector('[data-testid="assistant-sources-close"]') as HTMLElement | null;
      closeBtn?.focus();
    } else {
      // 1) Update aria, 2) focus badge NOW, 3) hide on next frame
      __badgeEl?.setAttribute('aria-expanded', 'false');
      __lastPopoverCloseTs = Date.now();
      const focusBadge = () => {
        const el = (document.getElementById('assistant-badge-focus') as HTMLElement | null) || __badgeEl;
        if (el && typeof (el as any).focus === 'function') {
          try { (el as any).focus({ preventScroll: true }); } catch {}
        }
      };
      focusBadge();
      // Defer hide to next frame so focus sticks
      requestAnimationFrame(() => {
        if (!__sourcesPopover) return;
        __sourcesPopover.classList.add('hidden');
        __sourcesPopover.setAttribute('data-open', 'false');
        __sourcesPopover.setAttribute('aria-hidden', 'true');
        (__sourcesPopover as any).hidden = true;
        (__sourcesPopover as HTMLElement).style.display = 'none';
        try { window.dispatchEvent(new CustomEvent('assistant:sources:closed')); } catch {}
      });
      // Staggered retries to reinforce focus after close
      [0, 50, 150, 300].forEach((ms) => setTimeout(() => { if (__sourcesPopover?.getAttribute('data-open') !== 'true') focusBadge(); }, ms));
    }
  }

  function attachBadgeInteractions(scope: HTMLElement | null){
    if (!scope) return;
    const badge = scope.querySelector('[data-testid="assistant-badge"]') as HTMLElement | null;
    if (!badge) return;
    // make interactive
  badge.setAttribute('role', 'button');
  badge.setAttribute('tabindex', '0');
  if (!badge.id) badge.id = 'assistant-badge-focus';
    badge.setAttribute('aria-controls', 'assistant-sources-popover');
    badge.setAttribute('aria-expanded', 'false');
    __badgeEl = badge;
    // Do not bind direct click/keydown handlers here to avoid double-handling.
    // Delegated document-level handlers below manage interactions and ensure singleton behavior.
  }

  // Delegated handlers to survive re-renders
  document.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement | null)?.closest?.('[data-testid="assistant-badge"]') as HTMLElement | null;
    if (!t) return;
    __badgeEl = t;
    e.preventDefault();
    e.stopPropagation();
    if (__lastGroundingMeta?.grounded && ((__lastGroundingMeta.sources?.length || 0) > 0)) {
      ensureSourcesPopover();
      toggleSourcesPopover(true);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const active = document.activeElement as HTMLElement | null;
    if (!active) return;
    const t = active.closest?.('[data-testid="assistant-badge"]') as HTMLElement | null;
    if (!t) return;
    __badgeEl = t;
    e.preventDefault();
    if (__lastGroundingMeta?.grounded && ((__lastGroundingMeta.sources?.length || 0) > 0)) {
      ensureSourcesPopover();
      toggleSourcesPopover(__sourcesPopover?.getAttribute('data-open') !== 'true');
    }
  });

  // Bind popover ESC/outside-click listeners once globally
  if (!window.__sourcesListenersBound) {
    window.__sourcesListenersBound = true;
    const escHandler = (e: KeyboardEvent) => {
      const pop = document.getElementById('assistant-sources-popover') as HTMLElement | null;
      if (!pop) return;
      const key = (e.key || '').toLowerCase();
      if ((key === 'escape' || key === 'esc') && pop.getAttribute('data-open') === 'true') {
        e.preventDefault();
        e.stopPropagation();
        // Rely on toggle to focus badge first, then hide on next frame and emit event
        toggleSourcesPopover(false);
      }
    };
    // Capture both keydown and keyup in capture phase to avoid being swallowed
    document.addEventListener('keydown', escHandler as any, true);
    document.addEventListener('keyup', escHandler as any, true);
    const outsideHandler = (e: Event) => {
      const pop = document.getElementById('assistant-sources-popover') as HTMLElement | null;
      // If pointerdown previously closed the popover in this sequence, consume the click to avoid closing the dock
      if ((e.type === 'click') && __justClosedPopoverByPointerDown) {
        __justClosedPopoverByPointerDown = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (!pop || pop.getAttribute('data-open') !== 'true') return;
      const t = e.target as Node;
      if (!pop.contains(t) && t !== __badgeEl) {
        e.preventDefault();
        e.stopPropagation();
        toggleSourcesPopover(false);
        // Mark that we closed on pointerdown to suppress the following click's default/handlers
        if (e.type === 'pointerdown') __justClosedPopoverByPointerDown = true;
      }
    };
    // Use capture and pointerdown to close earlier in the event lifecycle
    document.addEventListener('click', outsideHandler as any, true);
    document.addEventListener('pointerdown', outsideHandler as any, true);
    // Enforce focus after the click sequence completes
    document.addEventListener('pointerup', () => {
      if (!__sourcesPopover && __badgeEl) {
        try { (__badgeEl as any).focus?.({ preventScroll: true }); } catch {}
      }
    }, true);
  }

  function delay(ms: number){ return new Promise(r=> setTimeout(r, ms)); }
  async function streamChatOnce(payload: any, { onMeta, onChunk, onDone, signal, onSawMeta, streamAbortController }: any){
    console.debug('[assistant] chat POST', CHAT_STREAM_URL, payload);
    const resp = await fetch(CHAT_STREAM_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload), signal });
    if (!(resp instanceof Response) || !resp.ok) {
      const errText = resp instanceof Response ? await resp.text().catch(()=> '') : '';
      console.error('[assistant] stream non-200', resp instanceof Response ? resp.status : 'no-response', errText);
      throw new Error('bad_stream_response');
    }

    const extractPiece = (chunk: any): string => {
      if (!chunk) return '';

      // Handle multiple payload shapes
      const text =
        chunk?.delta?.content ??
        chunk?.message?.content ??
        chunk?.choices?.[0]?.delta?.content ??
        chunk?.choices?.[0]?.message?.content ??
        chunk?.content ??
        (typeof chunk === 'string' ? chunk : '');

      // Handle arrays
      if (Array.isArray(text)) return text.join('');
      if (typeof text === 'string') return text;
      return '';
    };

    // Dynamic grace window handling with heartbeats extending deadline until first token
  const metaEnv = (import.meta as any).env || {};
  const BASE_GRACE_MS = Number(metaEnv.VITE_SSE_GRACE_MS ?? 2400);
  const modelHint = String(metaEnv.VITE_PRIMARY_MODEL || '').toLowerCase();
  // derive from prompt length (~2ms/char up to 800ms)
  const est = BASE_GRACE_MS + Math.min((payload?.messages?.[1]?.content?.length || 0) * 2, 800);
  let graceMs = /gpt-oss:20b/.test(modelHint) ? Math.max(est, 2600) : est;
    let firstToken = false;
    let deadline = Date.now() + graceMs;
    let interval: number | undefined;

    function clearTicker(){ if (interval) { clearInterval(interval); interval = undefined as any; } }
    function bumpDeadline(extra = 1000){
      deadline = Date.now() + extra;
      clearTicker();
      interval = window.setInterval(()=>{
        if (Date.now() > deadline && !firstToken) {
          clearTicker();
          console.info('[assistant] stream grace elapsed; switching to JSON /api/chat');
          // Abort the stream fetch and let caller fallback
          try { (streamAbortController as AbortController | undefined)?.abort?.('grace-timeout'); } catch {}
        }
      }, 100);
    }

    bumpDeadline(graceMs);

    await readSSE(resp, {
      onMeta(meta: any){
        if (meta?._served_by) {
          onMeta?.(meta);
          onSawMeta?.();
          // If we can infer heavy local model, extend initial grace slightly
          try {
            const provider = String(meta?._served_by || '');
            // heuristic: known big local model name fragment
            if (provider.includes('primary') && (metaEnv.VITE_PRIMARY_MODEL || '').includes('gpt-oss:20b')) {
              graceMs = Math.max(graceMs, 2800);
              bumpDeadline(graceMs);
            }
          } catch {}
        }
      },
      onHeartbeat(){ bumpDeadline(1200); },
      onData(data: any){ const piece = extractPiece(data); if (piece) { firstToken = true; clearTicker(); onChunk?.(piece); } },
      onDone(){ clearTicker(); onDone?.(); },
      onError(err){ console.error('[assistant] stream error', err); }
    });
  }

  async function streamWithRetry(basePayload: any, handlers: any){
    const start = Date.now();
    const streamAbortController = new AbortController();
    let sawMetaAt = 0;

    const handleSawMeta = () => {
      if (sawMetaAt === 0) {
        sawMetaAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      }
    };

    for (let attempt=0; attempt <= STREAM_MAX_RETRIES; attempt++){
      const controller = new AbortController();
      const timeLeft = STREAM_OVERALL_TIMEOUT_MS - (Date.now() - start);
      const tOverall = setTimeout(()=> controller.abort(), Math.max(0, timeLeft));
      try {
        await streamChatOnce(basePayload, {
          ...handlers,
          signal: controller.signal,
          onSawMeta: handleSawMeta,
          streamAbortController
        });
        return { success: true, sawMetaAt, streamAbortController };
      } catch {
        if (controller.signal.aborted) break;
        if (attempt === STREAM_MAX_RETRIES) return { success: false, sawMetaAt, streamAbortController };
        const backoff = STREAM_RETRY_BASE_MS * (2 ** attempt) + Math.random() * STREAM_RETRY_JITTER_MS;
        await delay(backoff);
        continue;
      } finally { clearTimeout(tOverall); }
    }
    return { success: false, sawMetaAt, streamAbortController };
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
    const startedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    let firstTokenAt: number | null = null;
    let receivedTokens = 0;
  const metaEnv = (import.meta as any).env || {};
  const GRACE_AFTER_META_MS = Number(metaEnv.VITE_SSE_GRACE_MS ?? 2400);

    const showError = (text: string) => {
      if (ai.bubble) {
        ai.bubble.innerHTML = `<p><em>${text}</em></p>`;
      }
      if (assistantOutput) assistantOutput.textContent = text;
    };

    const fallbackNonStream = async ({ reason, skipStreamDone, streamAbortController }: { reason?: string; skipStreamDone?: boolean; streamAbortController?: AbortController } = {}) => {
      try {
        if (reason) console.info(`[assistant] ${reason}`);

        // Cancel the SSE stream to prevent double replies
        if (streamAbortController) {
          try {
            streamAbortController.abort('switch-to-json');
          } catch {}
        }

        const payload = {
          messages: [
            {
              role: 'system',
              content: "You are a warm, concise portfolio assistant. Prefer natural phrasing and end with a short follow-up question."
            },
            { role: 'user', content: q }
          ],
          temperature: 0.7,
          top_p: 0.95,
          include_sources: true
        };

        let signal: AbortSignal | undefined;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const supportsSignalTimeout = typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function';

        if (supportsSignalTimeout) {
          signal = (AbortSignal as any).timeout(30_000);
        } else if (typeof AbortController !== 'undefined') {
          const controller = new AbortController();
          signal = controller.signal;
          timeoutId = setTimeout(() => controller.abort(), 30_000);
        }

        const response = await fetch(CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal
        });

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const bodySnippet = await response.text().catch(() => '');
          console.error('[assistant] JSON fallback non-OK', response.status, bodySnippet.slice(0, 200));
          showError('Model did not return any text.');
          return;
        }

  const data = await response.json().catch(() => ({} as any));
  // Prefer stream-derived meta if present; merge with JSON response
  const prior: { raw: string; servedBy?: string; grounded?: boolean; sourcesCount?: number } | undefined = streamState.get(ai.id);
  const servedBy = data?._served_by || prior?.servedBy || 'unknown';
        const accent = accentColor();
  const message = data?.choices?.[0]?.message?.content ?? data?.message ?? data?.content ?? '';
  const grounded = typeof data?.grounded === 'boolean' ? data.grounded : prior?.grounded;
        const sourcesCount = Array.isArray(data?.sources) ? data.sources.length : prior?.sourcesCount;

        if (ai.bubble) {
          ai.bubble.innerHTML = '';
          const parts: string[] = [`served by <strong>${servedBy}</strong>`];
          if (grounded) {
            const badgeClasses = [
              'assistant-badge',
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm',
              'bg-neutral-100 text-neutral-800 border-neutral-300',
              'dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700',
              'cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-400',
              'transition-colors'
            ].join(' ');
            parts.push(`<span data-testid="assistant-badge" class="${badgeClasses}" aria-live="polite">grounded${typeof sourcesCount==='number' ? ` (${sourcesCount})` : ''}</span>`);
          }
          ai.bubble.insertAdjacentHTML('afterbegin', `<div class="served-by-line" data-accent="${accent}">${parts.join(' · ')}</div>`);
          if (servedBySpan) servedBySpan.textContent = servedBy;
          window.AgentStatus?.updateServed(servedBy);
          // Record last meta + wire popover
          __lastGroundingMeta = {
            grounded: !!grounded,
            sources: Array.isArray(data?.sources) ? data.sources : (__lastGroundingMeta?.sources || []),
            sources_count: typeof sourcesCount === 'number' ? sourcesCount : (__lastGroundingMeta?.sources_count || 0),
            _served_by: servedBy
          };
          attachBadgeInteractions(ai.bubble);

          // Guardrails badge (JSON fallback path) — render via React component
          try {
            const gr: any = (data && typeof data === 'object') ? (data.guardrails || null) : null;
            if (gr && (gr.flagged || gr.blocked)) {
              let footer = ai.bubble.querySelector('.assistant-meta') as HTMLElement | null;
              if (!footer) {
                footer = document.createElement('div');
                footer.className = 'assistant-meta';
                footer.style.display = 'flex';
                footer.style.alignItems = 'center';
                footer.style.gap = '8px';
                footer.style.marginTop = '6px';
                ai.bubble.appendChild(footer);
              }
              const holder = document.createElement('div');
              footer.appendChild(holder);
              const root = createRoot(holder);
              root.render(
                React.createElement(ShieldBadge as any, { flagged: !!gr.flagged, blocked: !!gr.blocked })
              );
            }
          } catch {}

          if (message) {
            if (assistantOutput) assistantOutput.textContent = message;
            ai.bubble.insertAdjacentHTML('beforeend', mdToHtml(message));
          } else if (!grounded) {
            const hint = '<p><em>Want the case study or a 60‑sec demo?</em></p>';
            if (assistantOutput) assistantOutput.textContent = 'Awaiting visitor preference…';
            ai.bubble.insertAdjacentHTML('beforeend', hint);
          } else {
            if (assistantOutput) assistantOutput.textContent = 'Model returned an empty reply.';
            ai.bubble.insertAdjacentHTML('beforeend', '<p><em>Model returned an empty reply.</em></p>');
          }

          // Append/reactively update route badge using backend metadata
          try {
            const scope = (data && typeof data === 'object') ? (data.scope || undefined) : undefined;
            try { (window as any).lastScope = scope; } catch {}
            const backends = (data && typeof data === 'object') ? (data.backends || undefined) : undefined;
            let footer = ai.bubble.querySelector('.assistant-meta') as HTMLElement | null;
            if (!footer) {
              footer = document.createElement('div');
              footer.className = 'assistant-meta';
              footer.style.display = 'flex';
              footer.style.alignItems = 'center';
              footer.style.gap = '8px';
              footer.style.marginTop = '6px';
              ai.bubble.appendChild(footer);
            }
            renderRouteBadge(footer, {
              scope,
              grounded: !!grounded,
              sourcesCount: typeof sourcesCount === 'number' ? sourcesCount : undefined,
              backends,
            });
          } catch {}

          // Update cached stream state for consistency, then finalize
          const st = getStreamState(ai.id);
          st.servedBy = servedBy;
          if (typeof grounded === 'boolean') st.grounded = grounded;
          if (typeof sourcesCount === 'number') st.sourcesCount = sourcesCount;
        }
      } catch (err) {
        console.warn('[assistant] stream failed AND JSON fallback failed', err);
        showError('Could not get a reply from the model.');
      } finally {
        if (!skipStreamDone) {
          streamDone(ai.id);
        }
        ensureFocus();
      }
    };
    const result = await streamWithRetry(
      {
        messages: [
          {
            role: 'system',
            content: "You are a warm, concise portfolio assistant. When the user asks about projects, pick the best match, explain in a friendly tone (2–4 short bullets), and end with one helpful follow-up question."
          },
          { role: 'user', content: q }
        ],
        stream: true,
        temperature: 0.7,
        top_p: 0.95,
        include_sources: true
      },
      {
        onMeta(meta: any){
          const state = getStreamState(ai.id);
          state.servedBy = meta._served_by;
          if (typeof meta.grounded === 'boolean') state.grounded = meta.grounded;
          if (Array.isArray(meta.sources)) state.sourcesCount = meta.sources.length;
          renderStream(ai.id, ai.bubble, true);
          if (servedBySpan) servedBySpan.textContent = meta._served_by;
          window.AgentStatus?.updateServed(meta._served_by);
          // Save detailed sources for popover
          __lastGroundingMeta = {
            grounded: !!meta?.grounded,
            sources: Array.isArray(meta?.sources) ? meta.sources : [],
            sources_count: typeof meta?.sources_count === 'number' ? meta.sources_count : (Array.isArray(meta?.sources) ? meta.sources.length : 0),
            _served_by: meta?._served_by || state.servedBy
          };
          // Pre-create popover so tests can find it after toggle without race
          if (__lastGroundingMeta.grounded && ((__lastGroundingMeta.sources?.length || 0) > 0)) {
            ensureSourcesPopover();
          }
          attachBadgeInteractions(ai.bubble);
          // Show badge during streaming based on meta (route may default to chitchat)
          try {
            let footer = ai.bubble.querySelector('.assistant-meta') as HTMLElement | null;
            if (!footer) {
              footer = document.createElement('div');
              footer.className = 'assistant-meta';
              footer.style.display = 'flex';
              footer.style.alignItems = 'center';
              footer.style.gap = '8px';
              footer.style.marginTop = '6px';
              ai.bubble.appendChild(footer);
            }
            // Guardrails badge if meta contains guardrails
            try {
              const gr: any = (meta && typeof meta === 'object') ? (meta.guardrails || null) : null;
              if (gr && (gr.flagged || gr.blocked)) {
                const existing = footer.querySelector('[data-testid="guardrails-badge"]');
                if (!existing) {
                  const holder = document.createElement('div');
                  footer.appendChild(holder);
                  const root = createRoot(holder);
                  root.render(React.createElement(ShieldBadge as any, { flagged: !!gr.flagged, blocked: !!gr.blocked }));
                }
              }
            } catch {}
            renderRouteBadge(footer, {
              scope: (meta && typeof meta === 'object' ? (meta.scope || undefined) : undefined),
              grounded: !!meta?.grounded,
              sourcesCount: Array.isArray(meta?.sources) ? meta.sources.length : undefined,
              backends: (meta && typeof meta === 'object' ? (meta.backends || undefined) : undefined),
            });
          } catch {}
        },
        onChunk(chunk: string){
          if (firstTokenAt === null) {
            firstTokenAt = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - startedAt;
          }
          receivedTokens += chunk.length > 0 ? 1 : 0;
          streamAppend(ai.id, chunk);
        },
        onDone(){
          try {
            // If we received a meta object earlier, try to render a final badge with last known scope/backends
            let footer = ai.bubble?.querySelector?.('.assistant-meta') as HTMLElement | null;
            if (!footer && ai.bubble) {
              footer = document.createElement('div');
              footer.className = 'assistant-meta';
              footer.style.display = 'flex';
              footer.style.alignItems = 'center';
              footer.style.gap = '8px';
              footer.style.marginTop = '6px';
              ai.bubble.appendChild(footer);
            }
            const meta = __lastGroundingMeta as any;
            if (footer) {
              renderRouteBadge(footer, {
                scope: meta?.scope,
                grounded: !!meta?.grounded,
                sourcesCount: typeof meta?.sources_count === 'number' ? meta.sources_count : (Array.isArray(meta?.sources) ? meta.sources.length : undefined),
                backends: meta?.backends,
              });
            }
          } catch {}
          streamDone(ai.id); ensureFocus();
        }
      }
    );

    if (result.success) {
      // Check if we need to fallback
      const sawMetaTimestamp = result.sawMetaAt || 0;

      if (receivedTokens === 0 && sawMetaTimestamp > 0) {
        // Stream completed but no tokens yet. Wait for grace period in case tokens are delayed.
        const elapsed = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - sawMetaTimestamp;
        const remainingGrace = GRACE_AFTER_META_MS - elapsed;

        if (remainingGrace > 0) {
          console.debug(`[assistant] waiting ${Math.round(remainingGrace)}ms grace period after meta...`);
          await new Promise(resolve => setTimeout(resolve, remainingGrace));
        }

        // Re-check token count after grace period
        if (receivedTokens === 0) {
          await fallbackNonStream({
            reason: 'stream produced no assistant tokens after grace period; falling back to JSON /api/chat',
            skipStreamDone: true,
            streamAbortController: result.streamAbortController
          });
        }
      } else if (receivedTokens === 0 && sawMetaTimestamp === 0) {
        // No meta received at all - immediate fallback
        await fallbackNonStream({
          reason: 'stream produced no meta or tokens; falling back to JSON /api/chat',
          skipStreamDone: true,
          streamAbortController: result.streamAbortController
        });
      } else if (receivedTokens > 0 && firstTokenAt !== null) {
        console.debug('[assistant] first token ms', Math.round(firstTokenAt));
      }
    } else {
      await fallbackNonStream({
        reason: 'stream attempt failed; using JSON /api/chat fallback',
        streamAbortController: result.streamAbortController
      });
    }
  });
  /* lint: end of module closure */
}

// Provide a harmless exported const to ensure module context without stray expression
export const __assistantDockModule = true;
