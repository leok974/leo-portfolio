/**
 * Calendly Integration with Nice-to-Haves
 * - Prefill name/email from URL or localStorage
 * - UTM tracking (source/campaign/medium)
 * - Locale support
 * - Accessibility (ARIA live regions)
 * - Privacy & consent management (DNT, GPC, window.__consent)
 * - Performance optimization (IntersectionObserver lazy loading)
 * - Custom events
 */

(function () {
  'use strict';

  // Query string helper
  const QS = new URLSearchParams(window.location.search);

  // LocalStorage helpers for prefill persistence
  const PREFILL_KEY = 'calendly-prefill';

  function readPrefill() {
    try {
      const stored = localStorage.getItem(PREFILL_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  }

  function savePrefill(data) {
    try {
      const existing = readPrefill();
      const merged = { ...existing, ...data };
      // Only save if we have name or email
      if (merged.name || merged.email) {
        localStorage.setItem(PREFILL_KEY, JSON.stringify(merged));
      }
    } catch (e) {
      // localStorage may be disabled
    }
  }

  /**
   * Build Calendly URL with prefill, UTM, and locale
   */
  function buildCalendlyUrl(baseUrl, opts = {}) {
    if (!baseUrl) return '';
    const u = new URL(baseUrl);

    // Prefill from URL params or localStorage
    const prefill = readPrefill();
    if (opts.prefill !== false) {
      const name = QS.get('name') || prefill.name;
      const email = QS.get('email') || prefill.email;
      if (name) u.searchParams.set('name', name);
      if (email) u.searchParams.set('email', email);
    }

    // UTM parameters (URL params override data-attrs)
    const utm = {
      utm_source: QS.get('utm_source') || opts.utm_source || 'portfolio',
      utm_campaign: QS.get('utm_campaign') || opts.utm_campaign || 'book-call',
      utm_medium: QS.get('utm_medium') || opts.utm_medium || 'cta',
    };
    for (const [k, v] of Object.entries(utm)) {
      if (v) u.searchParams.set(k, v);
    }

    // Locale
    const locale = QS.get('locale') || opts.locale;
    if (locale) u.searchParams.set('locale', locale);

    return u.toString();
  }

  /**
   * Announce to screen readers
   */
  function announce(msg) {
    const live = document.getElementById('calendly-live');
    if (!live) return;
    live.textContent = msg;
    // Clear after 3 seconds
    setTimeout(() => {
      if (live.textContent === msg) live.textContent = '';
    }, 3000);
  }

  /**
   * Check if user has consented to Calendly specifically
   * Uses new consent API with direct calendly flag check
   */
  function calendlyConsentAllowed() {
    // Use new consent API if available
    if (window.consent && typeof window.consent.get === 'function') {
      const consent = window.consent.get();
      // Check specifically for calendly consent flag
      return consent && consent.calendly === true;
    }

    // Fallback: check window.__consent for backward compatibility
    if (window.__consent) {
      return window.__consent.calendly === true;
    }

    // Check Do Not Track browser setting
    if (navigator.doNotTrack === '1') {
      return false;
    }

    // Check Global Privacy Control
    if (window.globalPrivacyControl === true) {
      return false;
    }

    // Default: allow if no explicit denial
    return true;
  }

  /**
   * Legacy function kept for analytics consent check
   * Analytics respects marketing/analytics flags separately
   */
  function consentAllowed() {
    // Check explicit consent object (from cookie banner)
    if (window.__consent) {
      if (window.__consent.marketing === false || window.__consent.analytics === false) {
        return false;
      }
    }

    // Check Do Not Track browser setting
    if (navigator.doNotTrack === '1') {
      return false;
    }

    // Check Global Privacy Control
    if (window.globalPrivacyControl === true) {
      return false;
    }

    return true;
  }

  /**
   * Track analytics event across multiple providers
   * Only tracks if consent allowed
   */
  function trackAnalytics(eventName, eventData = {}) {
    // Only track if consent allowed
    if (!consentAllowed()) return;

    // Always log for debugging/tests
    if (!window.__analyticsEvents) window.__analyticsEvents = [];
    window.__analyticsEvents.push({ event: eventName, ...eventData });

    // Google Analytics (gtag)
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, eventData);
    }

    // Google Tag Manager (dataLayer)
    if (window.dataLayer && Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: eventName, ...eventData });
    }

    // Plausible
    if (typeof window.plausible === 'function') {
      window.plausible(eventName, { props: eventData });
    }

    // Fathom (trackEvent)
    if (window.fathom && typeof window.fathom.trackEvent === 'function') {
      window.fathom.trackEvent(eventName);
    }

    // Fathom (trackGoal) - if event data includes goalId
    if (window.fathom && typeof window.fathom.trackGoal === 'function' && eventData.goalId) {
      window.fathom.trackGoal(eventData.goalId, eventData.value || 0);
    }

    // Umami
    if (window.umami && typeof window.umami.track === 'function') {
      window.umami.track(eventName, eventData);
    }
  }

  /**
   * Load Calendly external script once on demand
   */
  let calendlyLoaded = false;
  function ensureCalendly(cb) {
    if (window.Calendly) return cb();
    if (calendlyLoaded) return;
    calendlyLoaded = true;

    const s = document.createElement('script');
    s.src = 'https://assets.calendly.com/assets/external/widget.js';
    s.async = true;
    s.onload = () => cb();
    s.onerror = () => {
      console.error('Failed to load Calendly widget');
      announce('Failed to load booking widget. Please try again.');
    };
    document.head.appendChild(s);
  }

  /**
   * Initialize popup CTA button
   */
  function initPopupButton() {
    const btn = document.getElementById('book-call');
    if (!btn) return;

    const baseUrl = btn.getAttribute('data-calendly-url');
    if (!baseUrl) return;

    const opts = {
      utm_source: btn.getAttribute('data-calendly-utm-source') || undefined,
      utm_campaign: btn.getAttribute('data-calendly-utm-campaign') || undefined,
      utm_medium: btn.getAttribute('data-calendly-utm-medium') || undefined,
      locale: btn.getAttribute('data-calendly-locale') || undefined,
      prefill: btn.getAttribute('data-calendly-prefill') !== '0',
    };

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const url = buildCalendlyUrl(baseUrl, opts);

      ensureCalendly(() => {
        if (!window.Calendly) return;
        if (window.Calendly.initPopupWidget) {
          window.Calendly.initPopupWidget({ url });
          announce('Opening Calendly booking');

          // Track analytics
          trackAnalytics('calendly_open', {
            url,
            utm_source: opts.utm_source,
            utm_campaign: opts.utm_campaign,
            utm_medium: opts.utm_medium,
          });

          document.dispatchEvent(new CustomEvent('calendly:open', {
            detail: { url, baseUrl, opts }
          }));
        } else {
          // Fallback: open in new tab if API fails
          window.open(url, '_blank', 'noopener,noreferrer');
          announce('Opening Calendly in new tab');
        }
      });
    });
  }

  /**
   * Initialize inline widget with consent & performance optimization
   */
  function initInlineWidget() {
    const inline = document.getElementById('calendly-inline');
    if (!inline) return;

    // Get URL from inline element or fall back to button
    let baseUrl = inline.getAttribute('data-calendly-url');
    if (!baseUrl) {
      const btn = document.getElementById('book-call');
      baseUrl = btn?.getAttribute('data-calendly-url');
    }
    if (!baseUrl) return;

    const opts = {
      utm_source: inline.getAttribute('data-calendly-utm-source') || undefined,
      utm_campaign: inline.getAttribute('data-calendly-utm-campaign') || undefined,
      utm_medium: inline.getAttribute('data-calendly-utm-medium') || undefined,
      locale: inline.getAttribute('data-calendly-locale') || undefined,
      prefill: inline.getAttribute('data-calendly-prefill') !== '0',
    };

    const url = buildCalendlyUrl(baseUrl, opts);

    const loadInline = () => {
      if (!url) return;

      // Check Calendly-specific consent before loading third-party embed
      if (!calendlyConsentAllowed()) {
        // If consent denied, render fallback link instead of embedding
        inline.innerHTML = `<a href="${url}" rel="noopener" target="_blank">Book a call on Calendly</a>`;
        inline.setAttribute('data-calendly-initialized', '0');
        document.dispatchEvent(new CustomEvent('calendly:inline-denied', {
          detail: { url }
        }));
        return;
      }

      ensureCalendly(() => {
        if (!window.Calendly) return;

        if (window.Calendly.initInlineWidget) {
          window.Calendly.initInlineWidget({ url, parentElement: inline });
          inline.setAttribute('data-calendly-initialized', '1');
          announce('Calendly loaded inline');

          // Track analytics
          trackAnalytics('calendly_inline', {
            url,
            utm_source: opts.utm_source,
            utm_campaign: opts.utm_campaign,
            utm_medium: opts.utm_medium,
          });

          document.dispatchEvent(new CustomEvent('calendly:inline', {
            detail: { url, baseUrl, opts }
          }));
        } else {
          // Fallback to link if embed API missing
          inline.innerHTML = `<a href="${url}" rel="noopener" target="_blank">Book a call on Calendly</a>`;
          inline.setAttribute('data-calendly-initialized', '0');
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      });
    };

    // Defer inline load until visible (IntersectionObserver) or idle for performance
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some(e => e.isIntersecting)) {
          io.disconnect();
          loadInline();
        }
      });
      io.observe(inline);
    } else if ('requestIdleCallback' in window) {
      window.requestIdleCallback(loadInline, { timeout: 2500 });
    } else {
      setTimeout(loadInline, 0);
    }
  }

  /**
   * Persist prefill data from URL params for this session
   */
  function persistPrefillFromUrl() {
    const prefillNow = {
      name: QS.get('name'),
      email: QS.get('email')
    };
    if (prefillNow.name || prefillNow.email) {
      savePrefill(prefillNow);
    }
  }

  /**
   * Listen for consent changes and dynamically toggle inline widget
   * Uses both consent:change (bulk changes) and consent:changed (individual flags)
   */
  function handleConsentChange() {
    const inline = document.getElementById('calendly-inline');
    if (!inline) return;

    const allowed = calendlyConsentAllowed();
    const currentlyInitialized = inline.getAttribute('data-calendly-initialized') === '1';

    if (allowed && !currentlyInitialized) {
      // Consent granted and widget not yet loaded → initialize it
      console.log('[Calendly] Consent granted, loading widget');
      initInlineWidget();
    } else if (!allowed && currentlyInitialized) {
      // Consent revoked and widget is loaded → tear it down
      console.log('[Calendly] Consent revoked, tearing down widget');
      const baseUrl = inline.getAttribute('data-calendly-url');
      const btn = document.getElementById('book-call');
      const url = baseUrl || btn?.getAttribute('data-calendly-url');

      // Replace widget with fallback link
      inline.innerHTML = `<a href="${url}" rel="noopener" target="_blank">Book a call on Calendly</a>`;
      inline.setAttribute('data-calendly-initialized', '0');

      document.dispatchEvent(new CustomEvent('calendly:inline-revoked', {
        detail: { url }
      }));
    }
  }

  // Listen to bulk consent changes (from banner Accept/Decline)
  document.addEventListener('consent:change', handleConsentChange);

  // Listen to individual flag changes (from privacy settings page)
  window.addEventListener('consent:changed', (event) => {
    const detail = event.detail;
    // Only react if the calendly flag specifically changed
    if (detail && detail.key === 'calendly') {
      console.log('[Calendly] Calendly consent changed to:', detail.value);
      handleConsentChange();
    }
  });

  /**
   * Initialize on DOM ready
   */
  function init() {
    persistPrefillFromUrl();
    initPopupButton();
    initInlineWidget();
  }

  // Wait for both DOM and consent to be ready
  let domReady = false;
  let consentReady = false;

  function tryInit() {
    if (domReady && consentReady) {
      init();
    }
  }

  // DOM ready check
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      domReady = true;
      tryInit();
    });
  } else {
    domReady = true;
  }

  // Consent ready check
  if (window.consent && typeof window.consent.get === 'function') {
    consentReady = true;
  } else {
    window.addEventListener('consent:ready', () => {
      consentReady = true;
      tryInit();
    }, { once: true });
  }

  // If both already ready, init now
  tryInit();

  // Signal to tests that the helper finished wiring up
  try {
    window.__calendlyHelperLoaded = true;
    document.dispatchEvent(new CustomEvent('calendly:helper-ready'));
  } catch (e) {
    // Ignore errors in case CustomEvent is not supported
  }
})();
