/**
 * Simple Consent Banner for Calendly Integration
 * - Shows banner on first visit
 * - Stores preference in localStorage
 * - Emits 'consent:change' event for calendly.js to listen
 * - Respects DNT/GPC (auto-declines if set)
 * - Provides window.consent API for programmatic control
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'consent.v1';
  const BANNER_ID = 'consent-banner';

  // Resolve when consent is ready (useful for tests and pages)
  let _resolveReady;
  const readyPromise = new Promise((res) => (_resolveReady = res));

  // Check if user has DNT or GPC enabled
  function hasPrivacySignal() {
    try {
      const dnt = navigator.doNotTrack === '1' ||
                  window.doNotTrack === '1' ||
                  navigator.msDoNotTrack === '1';
      const gpc = window.globalPrivacyControl === true;
      return dnt || gpc;
    } catch {
      return false;
    }
  }

  // Read consent from localStorage
  function readConsent() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  // Save consent to localStorage
  function saveConsent(consent) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...consent,
        timestamp: Date.now(),
      }));
      window.__consent = consent;
      // Emit event for calendly.js to react
      try {
        document.dispatchEvent(new CustomEvent('consent:change', { detail: consent }));
        // Also broadcast individual changes so embedders can react instantly
        Object.keys(consent).forEach(key => {
          if (key !== 'timestamp') {
            window.dispatchEvent(
              new CustomEvent('consent:changed', { detail: { key, value: !!consent[key] } })
            );
          }
        });
      } catch {}
    } catch {}
  }

  // Clear consent (useful for testing)
  function clearConsent() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.__consent = null;
      document.dispatchEvent(new CustomEvent('consent:change', { detail: null }));
    } catch {}
  }

  // Show the consent banner (force = true will clear consent and re-show)
  function showBanner(force = false) {
    // If forcing, clear any existing consent
    if (force) {
      try {
        localStorage.removeItem(STORAGE_KEY);
        window.__consent = null;
      } catch {}
    }

    // Remove existing banner if present
    const existing = document.getElementById(BANNER_ID);
    if (existing) {
      existing.remove();
    }

    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'consent-title');
    banner.setAttribute('aria-describedby', 'consent-description');
    banner.innerHTML = `
      <div style="
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 1.5rem;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.3);
        z-index: 9999;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 0.95rem;
        line-height: 1.5;
      ">
        <div style="max-width: 1200px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between;">
          <div style="flex: 1; min-width: 300px;">
            <p id="consent-title" style="margin: 0 0 0.5rem 0; font-weight: 600; font-size: 1.1rem;">
              🍪 Cookie Preferences
            </p>
            <p id="consent-description" style="margin: 0; opacity: 0.9;">
              We use cookies to enable appointment booking and analytics. You can choose which features to enable.
              <a href="/privacy" style="color: #60a5fa; text-decoration: underline;">Privacy Policy</a>
            </p>
          </div>
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button id="consent-decline" style="
              padding: 0.75rem 1.5rem;
              background: transparent;
              border: 1px solid rgba(255,255,255,0.3);
              color: white;
              border-radius: 0.5rem;
              cursor: pointer;
              font-weight: 500;
              transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">
              Decline All
            </button>
            <button id="consent-accept" style="
              padding: 0.75rem 1.5rem;
              background: #3b82f6;
              border: none;
              color: white;
              border-radius: 0.5rem;
              cursor: pointer;
              font-weight: 500;
              transition: all 0.2s;
            " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
              Accept All
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Accept button
    document.getElementById('consent-accept')?.addEventListener('click', () => {
      saveConsent({
        analytics: true,
        marketing: true,
        calendly: true,
      });
      banner.remove();
    });

    // Decline button
    document.getElementById('consent-decline')?.addEventListener('click', () => {
      saveConsent({
        analytics: false,
        marketing: false,
        calendly: false,
      });
      banner.remove();
    });
  }

  // Initialize consent system
  function init() {
    // Check for existing consent
    const stored = readConsent();

    if (stored) {
      // Already has preference
      window.__consent = stored;
      return;
    }

    // Check privacy signals
    if (hasPrivacySignal()) {
      // Auto-decline if DNT/GPC enabled
      saveConsent({
        analytics: false,
        marketing: false,
        calendly: false,
      });
      return;
    }

    // No preference and no privacy signal - show banner
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => showBanner());
    } else {
      showBanner();
    }
  }

  // Public API
  window.consent = {
    get: readConsent,
    set: saveConsent,
    clear: clearConsent,
    hasPrivacySignal: hasPrivacySignal,
    showBanner: showBanner,
    onChanged: function(handler) {
      const fn = (e) => handler(e.detail);
      window.addEventListener('consent:changed', fn);
      return () => window.removeEventListener('consent:changed', fn);
    },
    ready: readyPromise,
  };

  // Initialize
  init();

  // Announce that consent API is available
  window.dispatchEvent(new Event('consent:ready'));
  _resolveReady?.();

  // ============================================================================
  // FOOTER PRIVACY LINKS (inject site-wide)
  // ============================================================================

  // Inject footer privacy links on all pages
  window.addEventListener('DOMContentLoaded', function(){
    try {
      // Only inject if not already present
      if (document.querySelector('[data-testid="manage-privacy"]')) return;

      // Find or create footer
      let footer = document.querySelector('footer.site-footer');
      if (!footer) {
        footer = document.createElement('footer');
        footer.className = 'site-footer';
        footer.style.cssText = 'margin-top:3rem;padding:1rem 1.25rem;border-top:1px solid rgba(125,125,125,.15);text-align:center;font:500 13px/1.6 Inter,system-ui,sans-serif;opacity:.9';
        document.body.appendChild(footer);
      }

      // Manage privacy link
      const link1 = document.createElement('a');
      link1.href = '#';
      link1.dataset.testid = 'manage-privacy';
      link1.textContent = 'Manage privacy';
      link1.style.textDecorationThickness = '1px';
      link1.style.textUnderlineOffset = '3px';
      link1.addEventListener('click', function(e){
        e.preventDefault();
        try {
          clearConsent();
        } catch {}
        try {
          showBanner(true);
        } catch {}
      });
      footer.appendChild(link1);

      // Separator
      const sep = document.createTextNode(' · ');
      footer.appendChild(sep);

      // Privacy settings link
      const link2 = document.createElement('a');
      link2.href = '/privacy.html';
      link2.dataset.testid = 'privacy-link';
      link2.textContent = 'Privacy settings';
      link2.style.textDecorationThickness = '1px';
      link2.style.textUnderlineOffset = '3px';
      footer.appendChild(link2);
    } catch {}
  });

  // ============================================================================
  // CONSENT ACCEPTANCE TRACKING (optional - only tracks when consent given)
  // ============================================================================

  // Track consent changes for analytics (privacy-compliant)
  document.addEventListener('consent:change', (event) => {
    const consent = event.detail; // null or {analytics, marketing, calendly}

    // Only track if user gave consent
    if (!consent) return;

    // Google Analytics (gtag)
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'consent_change', {
        analytics: consent.analytics,
        marketing: consent.marketing,
        calendly: consent.calendly,
        event_category: 'privacy',
        event_label: consent.analytics ? 'accepted' : 'declined'
      });
    }

    // Plausible Analytics
    if (typeof window.plausible === 'function') {
      window.plausible('consent_change', {
        props: {
          analytics: consent.analytics,
          marketing: consent.marketing,
          calendly: consent.calendly
        }
      });
    }

    // Fathom Analytics
    if (window.fathom && typeof window.fathom.trackEvent === 'function') {
      window.fathom.trackEvent('consent_change');
    }

    // Umami Analytics
    if (window.umami && typeof window.umami.track === 'function') {
      window.umami.track('consent_change', consent);
    }
  });
})();
