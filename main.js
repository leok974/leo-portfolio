// Partial typing remediation (keep JS, add JSDoc for stricter checkJs)
// -----------------------------
// UTIL modules (theme + status)
import { initThemeToggle } from './src/theme';
import { startStatusPoll } from './src/status-poll';

document.addEventListener('DOMContentLoaded', () => {
  const themeBtn = document.querySelector('#theme-toggle');
  if (themeBtn instanceof HTMLElement) initThemeToggle(themeBtn);
  // Status poll drives warming banner + agent indicator
  const banner = document.querySelector('#warming-banner');
  const agentDot = document.querySelector('#agent-dot');
  const agentBadge = document.querySelector('#agent-badge');
  startStatusPoll((s) => {
    const modelPresent = !!s?._ui?.modelPresent;
    const provider = s?._ui?.provider || 'unknown';
    const ready = !!(modelPresent && s?.ready);
    if (banner instanceof HTMLElement) banner.classList.toggle('hidden', ready || provider === 'primary');
    if (agentDot instanceof HTMLElement) {
      agentDot.classList.toggle('bg-green-500', ready);
      agentDot.classList.toggle('bg-amber-500', !ready && provider === 'warming');
      agentDot.classList.toggle('bg-red-500', !ready && !modelPresent && provider !== 'warming');
    }
    if (agentBadge instanceof HTMLElement) {
      const txt = modelPresent ? `Agent — ${provider}` : 'fallback (no model)';
      agentBadge.textContent = txt;
      agentBadge.setAttribute('data-provider', provider);
      agentBadge.setAttribute('data-model-present', String(modelPresent));
      // Accessibility enhancements: announce provider changes
      agentBadge.setAttribute('role', 'status');
      agentBadge.setAttribute('aria-live', 'polite');
      agentBadge.setAttribute('aria-label', `Chat provider status: ${txt}`);
    }
  });
});

// ---------------------------------
// STATUS PILL (TypeScript module)
// ---------------------------------
// Wire the migrated TypeScript polling logic into the bundle. The module
// attaches itself (DOM ready guarded) and drives the [data-status-pill]
// element based on /status/summary. Previously this lived at js/status-ui.js
// loaded via a direct <script>; now it is tree‑shaken & built by Vite.
import './src/status/status-ui.ts';

// -----------------------------
// FOOTER YEAR
// -----------------------------
const yearEl = /** @type {HTMLElement | null} */ (document.getElementById('year'));
  // Promote print-media stylesheet once loaded (replaces inline onload handler removed for CSP compliance)
document.addEventListener('DOMContentLoaded', () => {
  try { initAgentStatus(); } catch(e){ console.warn('initAgentStatus failed', e); }
  try { wireChatForm(); } catch(e){ console.warn('wireChatForm failed', e); }
  try { performCleanup(); } catch(e){ console.warn('performCleanup failed', e); }
  // Promote print-media stylesheet once loaded (replaces former inline onload handler for CSP compliance)
  document.querySelectorAll('link[rel="stylesheet"][data-media-onload]').forEach(el => {
    const link = /** @type {HTMLLinkElement} */ (el);
    link.addEventListener('load', () => {
      const target = link.getAttribute('data-media-onload');
      if (target) link.media = target;
    }, { once: true });
  });
});
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// -----------------------------
// LAZY-LOAD IMAGES/VIDEOS OUT OF VIEW (extra safety beyond native)
// -----------------------------
const io = new IntersectionObserver((entries)=>{
  for (const e of entries){
    if (e.isIntersecting) {
      const el = /** @type {HTMLElement} */ (e.target);
      if (el instanceof HTMLImageElement && el.dataset.src) { el.src = el.dataset.src; }
      if (el instanceof HTMLVideoElement) {
        if (el.dataset.poster) el.poster = el.dataset.poster;
      }
      io.unobserve(e.target);
    }
  }
}, { rootMargin: '200px' });
document.querySelectorAll('img[loading="lazy"], video[preload="metadata"]').forEach(el=> io.observe(el));

// -----------------------------
// PROJECT FILTERING
// -----------------------------
const chips = /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('.filters .chip'));
const statusChips = /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('.status-chip'));
const cards = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.card'));

let currentStatusFilter = 'in-progress'; // Default to in-progress
let currentCategoryFilter = 'all';

// Announce filter changes to screen readers
/** @param {string} filterName */
function announceFilterChange(filterName) {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = `Showing ${filterName === 'all' ? 'all' : filterName} projects`;
  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

// Apply both status and category filters
function applyFilters() {
  cards.forEach(card => {
    const slug = card.dataset.slug;
    const cats = (card.dataset.cats || '').split(' ');

    // Check category filter
    const matchesCategory = (currentCategoryFilter === 'all') || cats.includes(currentCategoryFilter);

    // Check status filter
    let matchesStatus = true;
    if (slug && PROJECT_DETAILS[slug]) {
      const status = PROJECT_DETAILS[slug].status || 'in-progress';
      if (currentStatusFilter !== 'all') {
        matchesStatus = status === currentStatusFilter;
      }
    }

    card.style.display = (matchesCategory && matchesStatus) ? '' : 'none';
  });
}

// Update filter counts
function updateFilterCounts() {
  if (!PROJECT_DETAILS || Object.keys(PROJECT_DETAILS).length === 0) return;

  const counts = { 'in-progress': 0, 'completed': 0, 'all': 0 };

  cards.forEach(card => {
    const slug = card.dataset.slug;
    if (slug && PROJECT_DETAILS[slug]) {
      const status = PROJECT_DETAILS[slug].status || 'in-progress';
      counts[status]++;
      counts['all']++;
    }
  });

  statusChips.forEach(chip => {
    const filter = /** @type {'in-progress' | 'completed' | 'all'} */ (chip.dataset.statusFilter);
    const countSpan = chip.querySelector('.filter-count');
    if (countSpan && filter) {
      countSpan.textContent = `(${counts[filter]})`;
    }
  });
}

// Status filter buttons
statusChips.forEach(chip => {
  chip.addEventListener('click', () => {
    statusChips.forEach(c => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', 'true');
    currentStatusFilter = /** @type {string} */ (chip.dataset.statusFilter);

    // Save preference
    try {
      localStorage.setItem('projectStatusFilter', currentStatusFilter);
    } catch (_e) {
      // Ignore storage errors
    }

    applyFilters();
    announceFilterChange(chip.querySelector('.filter-label')?.textContent || currentStatusFilter);
  });
});

// Category filter buttons
chips.forEach(chip => {
  chip.addEventListener('click', () => {
    chips.forEach(c => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', 'true');
    currentCategoryFilter = /** @type {string} */ (chip.dataset.filter);
    const filterName = chip.textContent.trim();

    applyFilters();
    announceFilterChange(filterName);
  });
});

// -----------------------------
// BUILD INFO (injected via Vite env var)
// -----------------------------
(() => {
  const el = document.querySelector('[data-build-info]');
  if (!el) return;
  // Vite import.meta.env shim typing
  const metaEnv = /** @type {any} */ (import.meta).env || {};
  const sha = metaEnv.VITE_BUILD_SHA || 'local';
  const dt = new Date().toISOString().slice(0,16).replace('T',' ');
  el.textContent = `build ${sha} · ${dt}`;
})();

// -----------------------------
// KEYBOARD NAVIGATION ENHANCEMENTS
// -----------------------------
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const openDialog = document.querySelector('dialog[open]');
    if (openDialog instanceof HTMLDialogElement) openDialog.close();
  }

  const target = event.target;
  if (target instanceof HTMLElement && target.classList.contains('chip')) {
    const chipButtons = Array.from(document.querySelectorAll('.chip')).map(el=> /** @type {HTMLButtonElement} */ (el));
    const currentIndex = chipButtons.indexOf(/** @type {HTMLButtonElement} */(target));
    if (currentIndex === -1) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % chipButtons.length;
      chipButtons[nextIndex].focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = currentIndex === 0 ? chipButtons.length - 1 : currentIndex - 1;
      chipButtons[prevIndex].focus();
    }
  }
});

// -----------------------------
// PROJECT DATA LOADING
// -----------------------------
/** @typedef {{
 * title: string; images?: Array<{src:string; alt:string; caption?:string}>; videos?: Array<{poster?:string; captions?:string; sources: Array<{src:string; type:string}>}>;
 * goals?: string; stack?: string[]; outcomes?: string[]; downloads?: Array<{href:string; label:string}>; repo?: string; demo?: string;
 * status?: 'in-progress' | 'completed'; date_completed?: string;
 * }} ProjectDetail
 */
/** @type {Record<string, ProjectDetail>} */
let PROJECT_DETAILS = {};

// Load project data from JSON file
async function loadProjectData() {
  try {
  // Use centralized API http only for API-base aware endpoints; this is a static asset fetch.
  // Keeping direct fetch here is fine; if moved behind edge under /api adjust accordingly.
  const response = await fetch('projects.json');
    PROJECT_DETAILS = await response.json();

    // Update filter counts and restore saved filter
    updateFilterCounts();

    // Restore saved status filter preference
    try {
      const saved = localStorage.getItem('projectStatusFilter');
      if (saved && ['in-progress', 'completed', 'all'].includes(saved)) {
        currentStatusFilter = saved;
        statusChips.forEach(chip => {
          chip.setAttribute('aria-pressed', chip.dataset.statusFilter === saved ? 'true' : 'false');
        });
      }
    } catch (_e) {
      // Ignore storage errors
    }

    // Apply filters after loading data
    applyFilters();
  } catch (error) {
    console.error('Failed to load project data:', error);
  }
}// Generate project detail HTML from data
/** @param {ProjectDetail} project */
function generateProjectHTML(project) {
  let html = '<div>';

  // Add images
  if (project.images && project.images.length > 0) {
  project.images.forEach(img => {
      if (img.caption) {
        html += `<figure>
          <img src="${img.src}" alt="${img.alt}"/>
          <figcaption class="muted">${img.caption}</figcaption>
        </figure>`;
      } else {
        html += `<img src="${img.src}" alt="${img.alt}" />`;
      }
    });
  }

  // Add videos
  if (project.videos && project.videos.length > 0) {
  project.videos.forEach(video => {
      html += `<video controls preload="metadata"${video.poster ? ` poster="${video.poster}"` : ''}>`;
  video.sources.forEach(source => {
        html += `<source src="${source.src}" type="${source.type}"/>`;
      });
      if (video.captions) {
        html += `<track label="English" kind="captions" srclang="en" src="${video.captions}" default>`;
      }
      html += '</video>';
    });
  }

  html += '</div><aside>';

  // Goals section
  if (project.goals) {
    html += `<h4>Goals</h4><p>${project.goals}</p>`;
  }

  // Stack section
  if (project.stack && project.stack.length > 0) {
    html += '<h4>Tools / Stack</h4><ul>';
    project.stack.forEach(item => {
      html += `<li>${item}</li>`;
    });
    html += '</ul>';
  }

  // Outcomes section
  if (project.outcomes && project.outcomes.length > 0) {
    html += '<h4>Outcomes</h4><ul>';
    project.outcomes.forEach(outcome => {
      html += `<li>${outcome}</li>`;
    });
    html += '</ul>';
  }

  // Downloads section
  if (project.downloads && project.downloads.length > 0) {
    html += '<div class="downloads">';
    project.downloads.forEach(download => {
      html += `<a href="${download.href}" download>${download.label}</a>`;
    });
    html += '</div>';
  }

  // Repository link
  if (project.repo) {
    html += `<div class="repo-link"><a class="btn" href="${project.repo}" target="_blank" rel="noopener">GitHub Repo ↗</a></div>`;
  }
  if (project.demo) {
    html += `<div class="repo-link"><a class="btn" href="${project.demo}" target="_blank" rel="noopener">Live Demo ↗</a></div>`;
  }

  html += '</aside>';
  return html;
}

// -----------------------------
// PROJECT DETAIL CONTENT (modal)
// -----------------------------

// Initialize project modal functionality
function initializeProjectModals() {
  const dialogEl = document.getElementById('detailDialog');
  const contentEl = document.getElementById('detailContent');
  if (!dialogEl || !contentEl) return; // Guard on pages without modal

  document.querySelectorAll('[data-detail]').forEach((btn) => {
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
    const key = btn.getAttribute('data-detail');
  if (!key) return;
  const data = PROJECT_DETAILS[key];
      if (!data) return;
  const titleEl = document.getElementById('detailTitle'); if (titleEl) titleEl.textContent = data.title;
      contentEl.innerHTML = generateProjectHTML(data);
  const dlg = /** @type {HTMLDialogElement} */ (dialogEl);
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open','');
    });
  });

    const closeBtn = document.getElementById('detailClose');
  if (closeBtn) closeBtn.addEventListener('click', ()=> { (/** @type {HTMLDialogElement} */(dialogEl)).close(); });

  // -----------------------------
  // ACCESSIBILITY ENHANCEMENTS
  // -----------------------------
  // Keyboard ESC closes the dialog
  dialogEl.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') (/** @type {HTMLDialogElement} */(dialogEl)).close(); });
  // Focus trap for dialog (very light)
  dialogEl.addEventListener('close', ()=>{ contentEl.innerHTML = ''; });
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
  await loadProjectData();
  initializeProjectModals();
  // Make project cards clickable to case study pages
  document.querySelectorAll('.card-click').forEach((card) => {
    card.addEventListener('click', (e)=> {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (!target) return;
      const tag = target.tagName.toLowerCase();
      if (['a','button'].includes(tag)) return;
      const slug = card.getAttribute('data-slug');
      if (slug) window.location.href = `projects/${slug}.html`;
    });
    card.addEventListener('keydown', (e)=> {
      const key = /** @type {KeyboardEvent} */ (e).key;
      if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        const slug = card.getAttribute('data-slug');
        if (slug) window.location.href = `projects/${slug}.html`;
      }
    });
  });
  // Gallery (on project detail pages)
  function initGallery(){
  const galleryDialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('galleryDialog'));
    if (!galleryDialog) return; // Not on project page
    const imgEl = /** @type {HTMLImageElement | null} */ (document.getElementById('galleryImage'));
    const captionEl = /** @type {HTMLParagraphElement | null} */ (document.getElementById('galleryCaption'));
    const announcerEl = /** @type {HTMLElement | null} */ (document.getElementById('galleryAnnouncer'));
    const prevBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('galleryPrev'));
    const nextBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('galleryNext'));
    const closeBtnG = /** @type {HTMLButtonElement | null} */ (document.getElementById('galleryClose'));
    const thumbsWrap = /** @type {HTMLElement | null} */ (document.getElementById('galleryThumbs'));
    const items = Array.from(
      document.querySelectorAll('.gallery-item'),
      (el) => /** @type {HTMLImageElement} */ (el)
    );
    if (!items.length || !imgEl || !captionEl || !closeBtnG) return;
    let idx = 0;
    /** @type {HTMLElement | null} */
    let lastFocusedBeforeOpen = null;
    /** @type {HTMLButtonElement[]} */
    let thumbButtons = [];

  /** @param {number} i */
  function preload(i){
      const target = items[(i + items.length) % items.length];
      if (!target) return;
      const src = target.getAttribute('src');
      if (!src) return;
      const img = new Image();
      img.src = src;
    }

  /** @param {number} i */
  function openAt(i){
      idx = (i + items.length) % items.length;
      const target = items[idx];
      if (imgEl){
        imgEl.src = target.getAttribute('src') || '';
        imgEl.alt = target.getAttribute('alt') || '';
      }
      const fig = target.closest('figure');
      if (captionEl) captionEl.textContent = fig ? (fig.querySelector('figcaption')?.textContent || '') : '';
      if (galleryDialog){
        if (typeof galleryDialog.showModal === 'function') {
          galleryDialog.showModal();
        } else {
          galleryDialog.setAttribute('open', '');
        }
      }
      if (thumbsWrap) {
        thumbButtons.forEach((button, buttonIndex) => {
          button.setAttribute('aria-current', buttonIndex === idx ? 'true' : 'false');
          button.tabIndex = buttonIndex === idx ? 0 : -1;
        });
      }
      if (announcerEl && captionEl) {
        const total = items.length;
        const slideNum = idx + 1;
        const caption = captionEl.textContent ? `: ${captionEl.textContent}` : '';
        announcerEl.textContent = `Slide ${slideNum} of ${total}${caption}`;
      }
      lastFocusedBeforeOpen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  closeBtnG?.focus();
      preload(idx + 1);
      preload(idx - 1);
    }

  items.forEach((item) => {
      item.addEventListener('click', () => {
        const parsed = Number.parseInt(item.dataset.galleryIndex || '', 10);
        if (Number.isInteger(parsed)) openAt(parsed);
      });
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          const parsed = Number.parseInt(item.dataset.galleryIndex || '', 10);
          if (Number.isInteger(parsed)) openAt(parsed);
        }
      });
      item.setAttribute('tabindex', '0');
    });

    const prev = () => openAt(idx - 1);
    const next = () => openAt(idx + 1);
  prevBtn?.addEventListener('click', prev);
  nextBtn?.addEventListener('click', next);
  closeBtnG.addEventListener('click', () => galleryDialog.close());
    galleryDialog.addEventListener('keydown', (event) => {
      const e = /** @type {KeyboardEvent} */ (event);
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') galleryDialog.close();
    });

    galleryDialog.addEventListener('keydown', (event) => {
      const e = /** @type {KeyboardEvent} */ (event);
      if (e.key === 'Tab') {
        const focusables = Array.from(
          galleryDialog.querySelectorAll('button, [href], img[tabindex="0"]')
        ).filter((el) => el instanceof HTMLElement && !el.hasAttribute('disabled'));
        if (!focusables.length) return;
        const focusable = /** @type {HTMLElement[]} */ (focusables);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    galleryDialog.addEventListener('close', () => {
      if (lastFocusedBeforeOpen) lastFocusedBeforeOpen.focus();
    });

  if (thumbsWrap) {
  items.forEach((item, imageIndex) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'listitem');
        btn.setAttribute('aria-label', `Slide ${imageIndex + 1}`);
        const src = item.getAttribute('src') || '';
        btn.innerHTML = `<img src="${src}" alt="">`;
  btn.addEventListener('click', () => openAt(imageIndex));
  btn.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openAt(imageIndex);
            return;
          }
          if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            let newIndex = imageIndex;
            if (event.key === 'ArrowRight') newIndex = (imageIndex + 1) % items.length;
            else if (event.key === 'ArrowLeft') newIndex = (imageIndex - 1 + items.length) % items.length;
            else if (event.key === 'Home') newIndex = 0;
            else if (event.key === 'End') newIndex = items.length - 1;
            thumbButtons[newIndex]?.focus();
          }
        });
        thumbsWrap.appendChild(btn);
      });
      thumbButtons = Array.from(thumbsWrap.querySelectorAll('button'), (el) =>
        /** @type {HTMLButtonElement} */ (el)
      );
      thumbButtons.forEach((button, buttonIndex) => {
        button.tabIndex = buttonIndex === 0 ? 0 : -1;
      });
    }

    let touchStartX = 0;
    let touchActive = false;
  galleryDialog.addEventListener('touchstart', (event) => {
      touchActive = true;
      touchStartX = event.touches[0]?.clientX ?? 0;
    }, { passive: true });
  galleryDialog.addEventListener('touchend', (event) => {
      if (!touchActive) return;
      const dx = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
      if (Math.abs(dx) > 40) {
        if (dx < 0) next();
        else prev();
      }
      touchActive = false;
    }, { passive: true });
  }
  initGallery();

  // Global IMG error fallback
  document.addEventListener('error', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLImageElement)) return;
    const fallback = 'assets/optimized/hero-placeholder-sm.webp';
    if (target.src.endsWith(fallback)) return;
    target.src = fallback;
    target.style.background = 'linear-gradient(180deg,#141b2d,#0b1223)';
  }, true);
});

// -------------------------------------
// NOTE: Dedicated detail pages (optional)
// -------------------------------------
// Later, create /projects/<slug>.html pages using the same content structure.
// For now, the modal shows a full case‑study experience without leaving the page.

// -----------------------------
// SERVICE WORKER REGISTRATION
// -----------------------------
// Dynamic API base selection retained (exposed for potential external scripts)
const IS_GH_PAGES = location.hostname.endsWith('github.io');
const API_BASE = IS_GH_PAGES ? 'https://assistant.ledger-mind.org/api' : '/api';
const windowWithApi = /** @type {typeof window & { __API_BASE__?: string, USE_BOTTOM_RIGHT_ASSISTANT?: boolean }} */ (window);
windowWithApi.__API_BASE__ = API_BASE;

// Moved from inline <script> (legacy assistant cleanup / duplication guard)
windowWithApi.USE_BOTTOM_RIGHT_ASSISTANT = false;
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.remove('assistant-open');
  if (document.body && document.body.style) document.body.style.paddingBottom = '';
  const legacyIds = ['assistant-panel','leo-assistant','la-panel','la-open'];
  legacyIds.forEach(id=>{ const el=document.getElementById(id); if (el) try{ el.remove(); }catch{} });
  const chipRoots = document.querySelectorAll('#assistant-chip-root');
  chipRoots.forEach((el,i)=>{ if(i>0) try{ el.remove(); }catch{} });
  const chipsDup = document.querySelectorAll('#assistant-chip');
  chipsDup.forEach((el,i)=>{ if(i>0) try{ el.remove(); }catch{} });
  const docks = document.querySelectorAll('.assistant-dock');
  docks.forEach((el,i)=>{ if(i>0) try{ el.remove(); }catch{} });
});

// Service worker registration (asset guard) — always enabled except localhost to avoid dev cache confusion.
if ('serviceWorker' in navigator) {
  const isLocal = ['localhost','127.0.0.1'].includes(location.hostname);
  if (!isLocal) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .catch(err => console.warn('SW registration failed', err));
    });
  }
}

// ---------------------------------
// ASSISTANT MODULE INTEGRATION
// ---------------------------------
// The assistant inline scripts were extracted to modules under src/assistant to
// reduce CSP surface (only JSON-LD remains inline). We lazy‑init after DOM ready.
import './src/assistant/chat-bootstrap';
import { initAgentStatus, wireChatForm } from './src/assistant/boot';
import { performCleanup } from './src/assistant/cleanup';

document.addEventListener('DOMContentLoaded', () => {
  try { initAgentStatus(); } catch(e){ console.warn('initAgentStatus failed', e); }
  try { wireChatForm(); } catch(e){ console.warn('wireChatForm failed', e); }
  try { performCleanup(); } catch(e){ console.warn('performCleanup failed', e); }
});
