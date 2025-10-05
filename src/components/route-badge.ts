// Lightweight route badge (vanilla DOM) for assistant messages
// Usage: createRouteBadge({ scope, grounded, sourcesCount, backends })

export interface BackendSnap { last_backend?: string; last_ms?: number }
export interface Scope { route?: "rag" | "faq" | "chitchat"; reason?: string; project_id?: string | null }

export function createRouteBadge(opts: {
  scope?: Scope;
  grounded?: boolean;
  sourcesCount?: number;
  backends?: { gen?: BackendSnap; embeddings?: BackendSnap; rerank?: BackendSnap };
}): HTMLElement {
  const scope = opts.scope || {};
  const route = scope.route || "chitchat";
  const grounded = !!opts.grounded;
  const sourcesCount = typeof opts.sourcesCount === "number" ? opts.sourcesCount : undefined;
  const backends = opts.backends || {};

  // Title tooltip with compact diagnostics
  const parts = [
    `route: ${route}`,
    scope.project_id ? `project: ${scope.project_id}` : null,
    `grounded: ${grounded ? "yes" : "no"}`,
    typeof sourcesCount === "number" ? `sources: ${sourcesCount}` : null,
    backends.gen?.last_backend ? `gen: ${backends.gen.last_backend} (${Math.round((backends.gen.last_ms || 0))} ms)` : null,
    backends.embeddings?.last_backend ? `embed: ${backends.embeddings.last_backend}` : null,
    backends.rerank?.last_backend ? `rerank: ${backends.rerank.last_backend}` : null,
    scope.reason ? `reason: ${scope.reason}` : null,
  ].filter(Boolean) as string[];
  const title = parts.join(" • ");

  // Colors (no Tailwind dependency). Subtle background with contrasting text.
  const routeColor = route === "rag" ? "#059669" : route === "faq" ? "#4f46e5" : "#475569"; // emerald-600, indigo-600, slate-600
  const dotColor = route === "rag" ? "#6ee7b7" : route === "faq" ? "#a5b4fc" : "#cbd5e1"; // emerald-300, indigo-300, slate-300

  const pill = document.createElement("span");
  pill.className = "route-badge";
  pill.setAttribute("data-testid", "route-badge");
  pill.title = title;
  pill.setAttribute("aria-label", title);
  // minimal inline styles for portability
  pill.style.display = "inline-flex";
  pill.style.alignItems = "center";
  pill.style.gap = "6px";
  pill.style.borderRadius = "9999px";
  pill.style.padding = "2px 8px";
  pill.style.fontSize = "12px";
  pill.style.fontWeight = "600";
  pill.style.color = "#fff";
  pill.style.background = routeColor;

  const dot = document.createElement("span");
  dot.style.width = "8px";
  dot.style.height = "8px";
  dot.style.borderRadius = "9999px";
  dot.style.background = dotColor;
  pill.appendChild(dot);

  const label = document.createElement("span");
  label.textContent = (route || "").toUpperCase();
  label.style.letterSpacing = "0.04em";
  pill.appendChild(label);

  if (scope.project_id) {
    const tag = document.createElement("span");
    tag.textContent = String(scope.project_id);
    tag.style.marginLeft = "4px";
    tag.style.background = "rgba(0,0,0,0.2)";
    tag.style.borderRadius = "4px";
    tag.style.padding = "0 4px";
    pill.appendChild(tag);
  }

  if (grounded) {
    const g = document.createElement("span");
    g.textContent = "grounded";
    g.style.marginLeft = "4px";
    g.style.background = "rgba(255,255,255,0.2)";
    g.style.borderRadius = "4px";
    g.style.padding = "0 4px";
    pill.appendChild(g);
  }

  if (typeof sourcesCount === "number" && sourcesCount >= 0) {
    const s = document.createElement("span");
    s.textContent = `${sourcesCount} src`;
    s.style.marginLeft = "4px";
    s.style.background = "rgba(255,255,255,0.1)";
    s.style.borderRadius = "4px";
    s.style.padding = "0 4px";
    pill.appendChild(s);
  }

  return pill;
}
