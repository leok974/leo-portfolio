/* eslint-disable */
/**
 * SEO JSON-LD Runtime Injector
 *
 * Dynamically fetches and injects JSON-LD structured data into the page at runtime.
 * This allows JSON-LD to be generated based on the current URL without build-time processing.
 *
 * Usage:
 * Add to your HTML <head>:
 *
 * <script>
 *   window.SEO_LD_ENABLED = true;
 *   window.SEO_LD_TYPES = null; // or ["WebPage","WebSite","BreadcrumbList","Person","Organization","CreativeWork","Article"]
 *   window.SEO_LD_ENDPOINT = "/agent/seo/ld/generate"; // proxied by nginx; else http://127.0.0.1:8001/agent/seo/ld/generate in dev
 * </script>
 * <script src="/assets/js/ld-inject.js" defer></script>
 *
 * Features:
 * - Zero-build deployment (works immediately)
 * - Page-type detection (projects vs articles)
 * - Idempotent (safe to call multiple times)
 * - Silent failure (doesn't break page if backend is unavailable)
 */

(() => {
  async function injectLd() {
    try {
      // Feature flag check
      // @ts-ignore - Custom window properties set in HTML
      if (!window.SEO_LD_ENABLED) return;

      const url = location.href;

      // Heuristic page-type → types
      const isProject = /\/projects\//.test(location.pathname);
      // @ts-ignore - Custom window properties
      const types = Array.isArray(window.SEO_LD_TYPES) && window.SEO_LD_TYPES.length
        // @ts-ignore
        ? window.SEO_LD_TYPES
        : (isProject
            ? ["WebPage","WebSite","BreadcrumbList","Person","Organization","CreativeWork"]
            : ["WebPage","WebSite","BreadcrumbList","Person","Organization","Article"]);

      // Fetch JSON-LD from backend
      // @ts-ignore - Custom window property
      const resp = await fetch(window.SEO_LD_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, types, dry_run: true })
      });

      // Silent failure if backend unavailable
      if (!resp.ok) return;

      const data = await resp.json();
      const blob = JSON.stringify(data.jsonld);

      // Idempotent injection - update existing or create new
      let el = document.querySelector('script[type="application/ld+json"]#ld-main');
      if (!el) {
        el = document.createElement("script");
        // @ts-ignore - Script element has type property
        el.type = "application/ld+json";
        el.id = "ld-main";
        document.head.appendChild(el);
      }
      el.textContent = blob;

      // Optional: dispatch event for analytics/monitoring
      // @ts-ignore - Custom window property
      if (window.SEO_LD_DEBUG) {
        console.log('[ld-inject] Injected JSON-LD:', data.jsonld);
      }
    } catch (err) {
      // Don't break the page on error
      // @ts-ignore - Custom window property
      if (window.SEO_LD_DEBUG) {
        console.warn('[ld-inject] Failed to inject JSON-LD:', err);
      }
    }
  }

  // Run on DOMContentLoaded or immediately if already loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectLd);
  } else {
    injectLd();
  }
})();
