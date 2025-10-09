import React from "react";
import { fetchSnapshot } from "../lib/metrics";
import { isDevUIEnabled } from "../lib/devGuard";

export default function MetricsBadge() {
  const [total, setTotal] = React.useState<number>(0);
  const [top, setTop] = React.useState<string>("");
  const [visible, setVisible] = React.useState(isDevUIEnabled());

  React.useEffect(() => {
    // Re-evaluate visibility in case user toggles dev flag later
    const id = setInterval(() => setVisible(isDevUIEnabled()), 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (!visible) return;
    let alive = true;
    async function tick() {
      // Pause polling when tab is hidden to save CPU
      if (document.hidden) return;

      try {
        const snap = await fetchSnapshot(10);
        if (!alive) return;
        setTotal(snap.total ?? 0);
        setTop((snap.by_event?.[0]?.event as string) || "—");
      } catch {
        // Silently fail
      }
    }
    void tick();
    // Add small jitter to prevent thundering herd
    const id = setInterval(() => { void tick(); }, 5000 + Math.floor(Math.random() * 500));
    return () => { alive = false; clearInterval(id); };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="ml-2 inline-flex items-center gap-2 px-2 py-1 rounded-full border text-xs opacity-85"
      aria-live="polite"
      aria-atomic="true"
      title="Behavior metrics (dev-only)"
    >
      <span className="uppercase tracking-wide">metrics</span>
      <span className="tabular-nums">{total}</span>
      <span className="opacity-70">{top || "—"}</span>
    </div>
  );
}
