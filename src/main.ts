// main.ts - TypeScript migrated from legacy root main.js
// Provides theme toggle, filtering, project modal, gallery, service worker logic,
// build info injection, and status pill import.

import './styles/tailwind.css';
import './status/status-ui';
import './api';
import './agent-status';
import './assistant-dock';
import { applyProjectFilter, announcementText } from './filters';
import { computeGalleryIndex } from './gallery-nav';
import { startLenis } from './lib/lenis';
import { render, h } from 'preact';
import * as React from 'react';
import Toasts from './components/Toasts';
import { enhanceCTAs } from './lib/enhance-ctas';
import { syncDevFlagFromQuery } from './lib/devGuard';
import MetricsBadge from './components/MetricsBadge';

// -----------------------------
// DEV FLAG SYNC (Phase 50.8)
// -----------------------------
syncDevFlagFromQuery();

// -----------------------------
// SMOOTH SCROLLING (LENIS)
// -----------------------------
(() => {
  // Only enable smooth scrolling if user hasn't requested reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion && typeof window !== 'undefined') {
    startLenis();
  }
})();

// -----------------------------
// TOASTS (SONNER)
// -----------------------------
(() => {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
    render(h(Toasts, null), toastContainer);
  }
})();

// -----------------------------
// METRICS BADGE (Phase 50.8)
// -----------------------------
(() => {
  const navRight = document.querySelector('.nav-right');
  if (navRight) {
    const badgeContainer = document.createElement('div');
    badgeContainer.id = 'metrics-badge-container';
    navRight.appendChild(badgeContainer);
    render(h(MetricsBadge, null), badgeContainer);
  }
})();

// -----------------------------
// AB TESTING TRACKING
// -----------------------------
(async () => {
  try {
    const { getBucket, fireAbEvent } = await import('./lib/ab');
    await getBucket();           // Assign sticky bucket
    await fireAbEvent("view");   // Record page view
  } catch (err) {
    console.warn('[AB] Failed to initialize tracking:', err);
  }
})();

// -----------------------------
// ENHANCE CTAs WITH LUCIDE ICONS
// -----------------------------
(() => {
  enhanceCTAs();
})();

// -----------------------------
// UTIL: THEME TOGGLE + STORAGE
// -----------------------------
(() => {
  const saved = localStorage.getItem('theme');
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  const initial: 'light' | 'dark' = (saved === 'light' || saved === 'dark')
    ? saved
    : (prefersLight ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', initial);
  const toggleBtn = document.getElementById('themeToggle');
  if (toggleBtn instanceof HTMLButtonElement) {
    toggleBtn.setAttribute('aria-pressed', String(initial === 'light'));
    toggleBtn.addEventListener('click', () => {
      const current = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      toggleBtn.setAttribute('aria-pressed', String(next === 'light'));
      localStorage.setItem('theme', next);
    });
  }
})();

// -----------------------------
// FOOTER YEAR
// -----------------------------
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// -----------------------------
// LAZY-LOAD IMAGES/VIDEOS OUT OF VIEW
// -----------------------------
const lazyObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target as (HTMLImageElement | HTMLVideoElement);
      const ds = (el as HTMLElement).dataset;
      if (ds.src && el instanceof HTMLImageElement) el.src = ds.src;
      if (ds.poster && el instanceof HTMLVideoElement) el.poster = ds.poster;
      lazyObserver.unobserve(el);
    }
  });
}, { rootMargin: '200px' });
document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach(el => lazyObserver.observe(el));
document.querySelectorAll<HTMLVideoElement>('video[preload="metadata"]').forEach(el => lazyObserver.observe(el));

// -----------------------------
// PROJECT FILTERING
// -----------------------------
const chips = document.querySelectorAll<HTMLButtonElement>('.chip');
const cards = document.querySelectorAll<HTMLElement>('.card');

function announceFilterChange(filterName: string) {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = `Showing ${filterName === 'all' ? 'all' : filterName} projects`;
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}

chips.forEach(chip => {
  chip.addEventListener('click', () => {
    chips.forEach(c => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', 'true');
    const f = chip.dataset.filter || 'all';
    const filterName = (chip.textContent || '').trim();
    applyProjectFilter(Array.from(cards), f);
    announceFilterChange(filterName);
  });
});

// -----------------------------
// BUILD INFO (Vite env var)
// -----------------------------
(() => {
  const el = document.querySelector<HTMLElement>('[data-build-info]');
  if (!el) return;
  const sha = (import.meta as any).env?.VITE_BUILD_SHA || 'local';
  const dt = new Date().toISOString().slice(0, 16).replace('T', ' ');
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
  if (target instanceof HTMLButtonElement && target.classList.contains('chip')) {
    const chipButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.chip'));
    const currentIndex = chipButtons.indexOf(target);
    if (currentIndex === -1) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      chipButtons[(currentIndex + 1) % chipButtons.length].focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      chipButtons[currentIndex === 0 ? chipButtons.length - 1 : currentIndex - 1].focus();
    }
  }
});

// -----------------------------
// PROJECT DATA LOADING & TYPES
// -----------------------------
interface ProjectMediaImage { src: string; alt: string; caption?: string; }
interface ProjectMediaVideoSource { src: string; type: string; }
interface ProjectMediaVideo { sources: ProjectMediaVideoSource[]; poster?: string; captions?: string; }
interface ProjectRecord {
  title: string;
  goals?: string;
  stack?: string[];
  outcomes?: string[];
  downloads?: { href: string; label: string; }[];
  repo?: string;
  demo?: string;
  images?: ProjectMediaImage[];
  videos?: ProjectMediaVideo[];
}

let PROJECT_DETAILS: Record<string, ProjectRecord> = {};

async function loadProjectData() {
  try {
    const response = await fetch('projects.json');
    PROJECT_DETAILS = await response.json();
  } catch (error) {
    console.error('Failed to load project data:', error);
  }
}

function generateProjectHTML(project: ProjectRecord): string {
  let html = '<div>';
  if (project.images?.length) {
    for (const img of project.images) {
      if (img.caption) {
        html += `<figure><img src="${img.src}" alt="${img.alt}"/><figcaption class="muted">${img.caption}</figcaption></figure>`;
      } else {
        html += `<img src="${img.src}" alt="${img.alt}" />`;
      }
    }
  }
  if (project.videos?.length) {
    for (const video of project.videos) {
      html += `<video controls preload="metadata"${video.poster ? ` poster="${video.poster}"` : ''}>`;
      for (const source of video.sources) {
        html += `<source src="${source.src}" type="${source.type}"/>`;
      }
      if (video.captions) {
        html += `<track label="English" kind="captions" srclang="en" src="${video.captions}" default>`;
      }
      html += '</video>';
    }
  }
  html += '</div><aside>';
  if (project.goals) html += `<h4>Goals</h4><p>${project.goals}</p>`;
  if (project.stack?.length) html += `<h4>Tools / Stack</h4><ul>${project.stack.map(s => `<li>${s}</li>`).join('')}</ul>`;
  if (project.outcomes?.length) html += `<h4>Outcomes</h4><ul>${project.outcomes.map(o => `<li>${o}</li>`).join('')}</ul>`;
  if (project.downloads?.length) html += `<div class="downloads">${project.downloads.map(d => `<a href="${d.href}" download>${d.label}</a>`).join('')}</div>`;
  if (project.repo) html += `<div class="repo-link"><a class="btn" href="${project.repo}" target="_blank" rel="noopener">GitHub Repo ↗</a></div>`;
  if (project.demo) html += `<div class="repo-link"><a class="btn" href="${project.demo}" target="_blank" rel="noopener">Live Demo ↗</a></div>`;
  html += '</aside>';
  return html;
}

function initializeProjectModals() {
  const dialogEl = document.getElementById('detailDialog') as HTMLDialogElement | null;
  const contentEl = document.getElementById('detailContent');
  if (!dialogEl || !contentEl) return;
  document.querySelectorAll<HTMLElement>('[data-detail]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const key = btn.getAttribute('data-detail');
      if (!key) return;
      const data = PROJECT_DETAILS[key];
      if (!data) return;
      const titleEl = document.getElementById('detailTitle');
      if (titleEl) titleEl.textContent = data.title;
      contentEl.innerHTML = generateProjectHTML(data);
      if (typeof dialogEl.showModal === 'function') dialogEl.showModal();
      else dialogEl.setAttribute('open', '');
    });
  });
  const closeBtn = document.getElementById('detailClose');
  closeBtn?.addEventListener('click', () => dialogEl.close());
  dialogEl.addEventListener('keydown', (e) => { if (e.key === 'Escape') dialogEl.close(); });
  dialogEl.addEventListener('close', () => { contentEl.innerHTML = ''; });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadProjectData();
  initializeProjectModals();

  // Import AB tracking
  const { fireAbEvent } = await import('./lib/ab').catch(() => ({
    fireAbEvent: async () => { /* noop */ }
  }));

  // card navigation
  document.querySelectorAll<HTMLElement>('.card-click').forEach(card => {
    card.addEventListener('click', async (e) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (['a', 'button'].includes(tag)) return;

      // Fire AB click event
      try {
        await fireAbEvent("click");
      } catch {
        // Ignore errors
      }

      const slug = card.getAttribute('data-slug');
      if (slug) window.location.href = `projects/${slug}.html`;
    });
    card.addEventListener('keydown', async (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();

        // Fire AB click event
        try {
          await fireAbEvent("click");
        } catch {
          // Ignore errors
        }

        const slug = card.getAttribute('data-slug');
        if (slug) window.location.href = `projects/${slug}.html`;
      }
    });
  });

  // Simple gallery (only if elements exist on detail pages)
  function initGallery() {
    const galleryDialog = document.getElementById('galleryDialog') as HTMLDialogElement | null;
    if (!galleryDialog) return;
    const imgEl = document.getElementById('galleryImage') as HTMLImageElement | null;
    const captionEl = document.getElementById('galleryCaption') as HTMLParagraphElement | null;
    const announcerEl = document.getElementById('galleryAnnouncer') as HTMLElement | null;
    const prevBtn = document.getElementById('galleryPrev') as HTMLButtonElement | null;
    const nextBtn = document.getElementById('galleryNext') as HTMLButtonElement | null;
    const closeBtnG = document.getElementById('galleryClose') as HTMLButtonElement | null;
    const thumbsWrap = document.getElementById('galleryThumbs') as HTMLElement | null;
    const items = Array.from(document.querySelectorAll<HTMLImageElement>('.gallery-item'));
    if (!items.length || !imgEl || !captionEl || !closeBtnG) return;
    let idx = 0;
    let lastFocusedBeforeOpen: HTMLElement | null = null;
    let thumbButtons: HTMLButtonElement[] = [];

    function preload(i: number) {
      const target = items[(i + items.length) % items.length];
      if (!target) return;
      const src = target.getAttribute('src');
      if (!src) return;
      const img = new Image();
      img.src = src; // trigger load
    }

    function openAt(i: number) {
      idx = (i + items.length) % items.length;
      const target = items[idx];
      if (imgEl) imgEl.src = target.getAttribute('src') || '';
      if (imgEl) imgEl.alt = target.getAttribute('alt') || '';
      const fig = target.closest('figure');
      if (captionEl) captionEl.textContent = fig ? (fig.querySelector('figcaption')?.textContent || '') : '';
      if (galleryDialog) {
        if (typeof galleryDialog.showModal === 'function') galleryDialog.showModal();
        else galleryDialog.setAttribute('open', '');
      }
      if (thumbsWrap) {
        thumbButtons.forEach((button, buttonIndex) => {
          button.setAttribute('aria-current', String(buttonIndex === idx));
          button.tabIndex = buttonIndex === idx ? 0 : -1;
        });
      }
      if (announcerEl) {
        const total = items.length;
        const slideNum = idx + 1;
        const caption = captionEl?.textContent ? `: ${captionEl.textContent}` : '';
        announcerEl.textContent = `Slide ${slideNum} of ${total}${caption}`;
      }
      lastFocusedBeforeOpen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      closeBtnG?.focus();
      preload(idx + 1); preload(idx - 1);
    }

    items.forEach((item, imageIndex) => {
      item.addEventListener('click', () => openAt(imageIndex));
      item.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Enter') openAt(imageIndex);
      });
      item.tabIndex = 0;
    });

    const prev = () => openAt(idx - 1);
    const next = () => openAt(idx + 1);
    prevBtn?.addEventListener('click', prev);
    nextBtn?.addEventListener('click', next);
    closeBtnG.addEventListener('click', () => galleryDialog.close());
    galleryDialog.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') galleryDialog.close();
    });
    galleryDialog.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const focusables = Array.from(galleryDialog.querySelectorAll<HTMLElement>('button, [href], img[tabindex="0"]'))
          .filter(el => !el.hasAttribute('disabled'));
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    galleryDialog.addEventListener('close', () => { if (lastFocusedBeforeOpen) lastFocusedBeforeOpen.focus(); });

    if (thumbsWrap) {
      items.forEach((item, imageIndex) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'listitem');
        btn.setAttribute('aria-label', `Slide ${imageIndex + 1}`);
        const src = item.getAttribute('src') || '';
        btn.innerHTML = `<img src="${src}" alt="">`;
        btn.addEventListener('click', () => openAt(imageIndex));
        btn.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAt(imageIndex); return; }
          if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            const newIndex = computeGalleryIndex(imageIndex, e.key as any, items.length);
            thumbButtons[newIndex]?.focus();
          }
        });
        thumbsWrap.appendChild(btn);
      });
      thumbButtons = Array.from(thumbsWrap.querySelectorAll<HTMLButtonElement>('button'));
      thumbButtons.forEach((button, buttonIndex) => { button.tabIndex = buttonIndex === 0 ? 0 : -1; });
    }

    let touchStartX = 0;
    let touchActive = false;
    galleryDialog.addEventListener('touchstart', (e) => {
      touchActive = true; touchStartX = e.touches[0]?.clientX ?? 0;
    }, { passive: true });
    galleryDialog.addEventListener('touchend', (e) => {
      if (!touchActive) return;
      const dx = (e.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
      if (Math.abs(dx) > 40) { if (dx < 0) next(); else prev(); }
      touchActive = false;
    }, { passive: true });
  }
  initGallery();

  // Global IMG error fallback
  document.addEventListener('error', (event) => {
    const target = event.target as HTMLElement;
    if (!(target instanceof HTMLImageElement)) return;
    const fallback = 'assets/optimized/hero-placeholder-sm.webp';
    if (target.src.endsWith(fallback)) return;
    target.src = fallback;
  // Instead of inline style, add a CSS class for fallback background
  target.classList.add('img-fallback-gradient');
  }, true);
});

// -----------------------------
// SERVICE WORKER REGISTRATION
// -----------------------------
const IS_GH_PAGES = location.hostname.endsWith('github.io');
const API_BASE = IS_GH_PAGES ? 'https://assistant.ledger-mind.org/api' : '/api';
(window as any).__API_BASE__ = API_BASE;

if ('serviceWorker' in navigator) {
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (isLocal || IS_GH_PAGES) {
    navigator.serviceWorker.getRegistrations?.().then(regs => regs.forEach(r => r.unregister()));
  } else {
    const basePath = location.pathname.includes('/leo-portfolio/') ? '/leo-portfolio/' : '/';
    const swUrl = `${basePath}sw.js`;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(swUrl).catch(err => console.warn('Service worker registration failed:', err));
    });
  }
}
