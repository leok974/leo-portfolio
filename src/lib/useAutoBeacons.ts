import { useEffect } from "react";
import { getVisitorId, sendEvent } from "./metrics";

/**
 * Auto-beacon hook for tracking page views and link clicks.
 * Call once at app entry (e.g., in App.tsx or main layout component).
 */
export function useAutoBeacons() {
  useEffect(() => {
    const vid = getVisitorId();

    // Send page_view event on mount
    void sendEvent({
      visitor_id: vid,
      event: "page_view",
      metadata: { path: location.pathname }
    });

    // Track link clicks
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const a = t.closest?.("a[href]") as HTMLAnchorElement | null;
      if (a) {
        void sendEvent({
          visitor_id: vid,
          event: "link_click",
          metadata: { href: a.href }
        });
      }
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}
