/**
 * Privacy Settings Page - Manages granular consent controls
 * Works with consent.js API to provide UI for toggling analytics/marketing/calendly
 */
(function(){
  // Helpers to interact with consent.js API
  function get(){
    return (window.consent && window.consent.get && window.consent.get()) || { analytics:false, marketing:false, calendly:false };
  }
  function set(obj){
    if (window.consent?.set) window.consent.set(obj);
  }
  function clear(){
    if (window.consent?.clear) window.consent.clear();
    if (window.consent?.showBanner) window.consent.showBanner(true);
  }

  // Update UI from current consent
  function ui(){
    const c = get() || { analytics:false, marketing:false, calendly:false };
    document.getElementById('chk-analytics').checked = !!c.analytics;
    document.getElementById('chk-marketing').checked = !!c.marketing;
    document.getElementById('chk-calendly').checked = !!c.calendly;
  }

  // Mark page as ready for tests (with optional reason for debugging)
  const markReady = (reason) => {
    if (!window.__privacyPageReady) {
      window.__privacyPageReady = true;
      window.__privacyPageReadyReason = reason;
      console.log('[Privacy] Page ready:', reason);
    }
  };

  // Initialize page with consent system available
  const initWithConsent = () => {
    console.log('[Privacy] Initializing with consent...');
    ui();

    // Save button
    document.getElementById('btn-save').addEventListener('click', function(){
      const newConsent = {
        analytics: document.getElementById('chk-analytics').checked,
        marketing: document.getElementById('chk-marketing').checked,
        calendly: document.getElementById('chk-calendly').checked
      };
      set(newConsent);

      // Show feedback
      const status = document.getElementById('status');
      status.textContent = '✓ Preferences saved';
      setTimeout(() => { status.textContent = ''; }, 3000);
    });

    // Reset button
    document.getElementById('btn-reset').addEventListener('click', function(){
      clear();

      // Show feedback
      const status = document.getElementById('status');
      status.textContent = 'Preferences cleared. Banner will re-appear on next page load.';
      setTimeout(() => {
        status.textContent = '';
        // Redirect to home to show banner
        window.location.href = '/';
      }, 2000);
    });

    // Listen for consent changes (e.g., from banner)
    document.addEventListener('consent:change', ui);

    // Signal that page is ready
    markReady('consent-available');
  };

  // Deterministic initialization: no more polling!
  const initialize = () => {
    console.log('[Privacy] Initialize called, consent?', !!window.consent);
    if (window.consent && typeof window.consent.get === 'function') {
      // consent.js already loaded
      console.log('[Privacy] consent.js already loaded');
      initWithConsent();
      return;
    }
    // If consent.js loads later, initialize on the readiness event
    console.log('[Privacy] Waiting for consent:ready event');
    window.addEventListener('consent:ready', () => {
      console.log('[Privacy] consent:ready event received');
      initWithConsent();
    }, { once: true });
    // Hard fallback so tests/pages never hang even if consent.js 404s/CSP blocks
    console.log('[Privacy] Setting 500ms fallback timeout');
    setTimeout(() => markReady('fallback:timeout'), 500);
  };

  // Run initialization when DOM is ready (or immediately if already ready)
  console.log('[Privacy] Script loaded, readyState:', document.readyState);
  if (document.readyState === 'loading') {
    console.log('[Privacy] Still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    // Document already loaded (e.g., Playwright navigation)
    console.log('[Privacy] Already loaded, initializing now');
    initialize();
  }
})();
