/**
 * Portfolio UI - Main Entry Point
 * Vanilla shell with Preact islands
 */

import "../portfolio.css";
import { loadLayout } from "./layout";
import { initAdminFromQuery } from "./admin";
import { mountDevOverlayIfEnabled } from "./dev-overlay";

// Import portfolio grid logic
import "../portfolio";

// Capture ?admin=1 from URL and persist (dev override)
initAdminFromQuery();

// Load layout recipe from backend on boot
loadLayout();

// Initialize Calendly with env-based URL
const CALENDLY_URL = import.meta.env.VITE_CALENDLY_URL || 'https://calendly.com/leoklemet-pa';

// Global flag to prevent Ada double-start
declare global {
  interface Window {
    __ADA_STARTED__?: boolean;
    __CALENDLY_STARTED__?: boolean;
  }
}

// Start Calendly only once
function startCalendlyOnce() {
  if (window.__CALENDLY_STARTED__) return;
  window.__CALENDLY_STARTED__ = true;

  // Update inline widget data-url
  const inlineWidget = document.querySelector('.calendly-inline-widget');
  if (inlineWidget) {
    inlineWidget.setAttribute('data-url', CALENDLY_URL);
  }

  // Initialize inline widget with correct URL
  if (typeof (window as any).Calendly !== 'undefined') {
    (window as any).Calendly.initInlineWidget({
      url: CALENDLY_URL,
      parentElement: document.querySelector('.calendly-inline-widget'),
      prefill: {},
      utm: {}
    });
  }
}

// Update Calendly URLs in DOM when ready
document.addEventListener('DOMContentLoaded', () => {
  startCalendlyOnce();

  // Update popup button handler
  const popupBtn = document.getElementById('calendly-popup-btn');
  if (popupBtn) {
    popupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof (window as any).Calendly !== 'undefined') {
        (window as any).Calendly.initPopupWidget({ url: CALENDLY_URL });
      }
      return false;
    });
  }

  // Copy for LinkedIn button handler (reusable function)
  const setupCopyButton = (btnId: string) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.addEventListener('click', async () => {
      try {
        const response = await fetch('/resume/copy.txt?limit=2600', { credentials: 'include' });
        if (!response.ok) throw new Error(`Failed to fetch resume: ${response.status}`);
        const text = await response.text();
        await navigator.clipboard.writeText(text);

        // Visual feedback
        const originalHTML = btn.innerHTML;
        const iconSpan = btn.querySelector('.contact-icon');
        if (iconSpan) {
          iconSpan.textContent = '✅';
          const textSpan = btn.querySelector('span:not(.contact-icon)');
          if (textSpan) textSpan.textContent = 'Copied!';
        } else {
          btn.innerHTML = '✅ Copied!';
        }

        setTimeout(() => {
          btn.innerHTML = originalHTML;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy resume:', err);
        const iconSpan = btn.querySelector('.contact-icon');
        if (iconSpan) {
          iconSpan.textContent = '❌';
        } else {
          btn.innerHTML = '❌ Failed';
        }
        setTimeout(() => {
          if (iconSpan) iconSpan.textContent = '📋';
          else btn.innerHTML = '📋 Copy for LinkedIn';
        }, 2000);
      }
    });
  };

  setupCopyButton('copy-linkedin-btn');
  setupCopyButton('copy-linkedin-btn-footer');
});

// Log when layout is loaded
window.addEventListener("layout:update", (e) => {
  const customEvent = e as CustomEvent;
  console.log("Layout loaded:", customEvent.detail);
});

// Mount dev overlay if enabled (sa_dev cookie present)
mountDevOverlayIfEnabled();

console.log("Portfolio shell initialized");

// Signal to E2E tests that the app is fully mounted and stable
declare global {
  interface Window {
    __APP_READY__?: boolean;
  }
}
window.__APP_READY__ = true;
