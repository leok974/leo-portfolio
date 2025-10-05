import React from "react";
import { createRoot } from "react-dom/client";
import { API } from "@/api";
import { AdminRebuildButton } from "@/components/AdminRebuildButton";
import { AdminToolsPanel } from "@/components/AdminToolsPanel";
import { AdminEvalWidget } from "@/components/AdminEvalWidget";
import { AdminFeedbackWidget } from "@/components/AdminFeedbackWidget";

export function mountAdminRebuildFloating(base = "") {
  // Preferred base: explicit override → env → current origin
  const preferred = (() => {
    try {
      const w = (typeof window !== 'undefined') ? (window as any) : {};
      const origin = (typeof location !== 'undefined') ? location.origin : '';
      const raw = (w.__API_BASE__ || (import.meta as any)?.env?.VITE_API_BASE || origin || '').toString();
      // Normalize: drop single trailing slash and trailing '/api' so we can safely append '/api/...'
      let norm = raw.replace(/\/$/, '');
      if (norm.endsWith('/api')) norm = norm.replace(/\/api$/, '');
      return norm;
    } catch { return ""; }
  })();

  // Legacy fallback: derive from API.base by stripping trailing /api
  const derived = (() => {
    try {
      const b = (API?.base || "");
      return b.endsWith("/api") ? b.replace(/\/api$/, "") : b;
    } catch { return ""; }
  })();

  const finalBase = base || preferred || derived || "";
  // create a floating dock (bottom-right)
  let host = document.getElementById("admin-rebuild-dock");
  if (!host) {
    host = document.createElement("div");
    host.id = "admin-rebuild-dock";
    Object.assign(host.style, {
      position: "fixed",
      right: "16px",
  bottom: "96px", // bottom-24 to avoid physical overlap with assistant chip
      zIndex: "9998", // keep below assistant chip
      pointerEvents: "none", // container doesn't catch clicks; cards re-enable
      display: "flex",
      gap: "12px",
      flexDirection: "column",
      maxWidth: "calc(100vw - 32px)",
    });
    document.body.appendChild(host);
  }

  const card1 = document.createElement("div"); card1.style.pointerEvents = 'auto';
  const card2 = document.createElement("div"); card2.style.pointerEvents = 'auto';
  const card3 = document.createElement("div"); card3.style.pointerEvents = 'auto';
  const card4 = document.createElement("div"); card4.style.pointerEvents = 'auto';
  host.appendChild(card1);
  host.appendChild(card2);
  host.appendChild(card3);
  host.appendChild(card4);

  createRoot(card1).render(<AdminRebuildButton base={finalBase} />);
  try { createRoot(card2).render(<AdminToolsPanel base={finalBase} />); } catch {}
  try { createRoot(card3).render(<AdminEvalWidget base={finalBase} />); } catch {}
  try { createRoot(card4).render(<AdminFeedbackWidget base={finalBase} />); } catch {}
}
