/* eslint-disable */
// @ts-nocheck
(function () {
  const INGEST =
    (window.BACKEND_BASE || "http://127.0.0.1:8001") + "/agent/metrics/ingest";
  const sid =
    (crypto.randomUUID && crypto.randomUUID().slice(0, 12)) ||
    String(Math.random()).slice(2, 14);
  const vid =
    localStorage.getItem("v_id") ||
    (() => {
      const v = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()))
        .replace(/-/g, "")
        .slice(0, 16);
      localStorage.setItem("v_id", v);
      return v;
    })();
  const q = [];
  let t = null;
  function push(ev) {
    q.push(ev);
    schedule();
  }
  function schedule() {
    if (t) return;
    t = setTimeout(flush, 1500);
  }
  function flush() {
    const payload = JSON.stringify({ events: q.splice(0) });
    const ok =
      navigator.sendBeacon &&
      navigator.sendBeacon(
        INGEST,
        new Blob([payload], { type: "application/json" })
      );
    if (!ok) {
      fetch(INGEST, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
    t = null;
  }
  const timers = new Map();
  const io = new IntersectionObserver(
    (entries) => {
      const now = new Date().toISOString();
      entries.forEach((e) => {
        const el = e.target;
        const sec = el.getAttribute("data-section");
        if (!sec) return;
        const variant = el.getAttribute("data-variant") || undefined;
        if (e.isIntersecting) {
          push({
            session_id: sid,
            visitor_id: vid,
            section: sec,
            variant,
            event_type: "view",
            ts: now,
            viewport_pct: e.intersectionRatio,
          });
          timers.set(sec, performance.now());
        } else if (timers.has(sec)) {
          const d = Math.round(performance.now() - timers.get(sec));
          push({
            session_id: sid,
            visitor_id: vid,
            section: sec,
            variant,
            event_type: "dwell",
            ts: now,
            dwell_ms: d,
          });
          timers.delete(sec);
        }
      });
    },
    { threshold: [0.25, 0.5, 0.75] }
  );
  document.querySelectorAll("[data-section]").forEach((el) => io.observe(el));
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-section]");
    if (!el) return;
    const variant = el.getAttribute("data-variant") || undefined;
    push({
      session_id: sid,
      visitor_id: vid,
      section: el.getAttribute("data-section"),
      variant,
      event_type: "click",
      ts: new Date().toISOString(),
    });
  });
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (q.length) flush();
    }
  });
})();
