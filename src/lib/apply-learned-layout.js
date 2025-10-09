/* eslint-disable */
// @ts-nocheck
(async function () {
  try {
    const LAYOUT =
      (window.BACKEND_BASE || "http://127.0.0.1:8001") + "/agent/layout";
    const res = await fetch(LAYOUT);
    const { order } = await res.json();
    const root = document.querySelector("main") || document.body;
    const map = {};
    root
      .querySelectorAll("[data-section]")
      .forEach((n) => (map[n.dataset.section] = n));
    order.forEach((s) => map[s] && root.appendChild(map[s]));
  } catch (_e) {}
})();
