import { useEffect, useState } from "react";

interface LayoutData {
  generated_at?: number;
  preset?: string;
  sections?: {
    featured?: unknown[];
  };
}

export function LastRunBadge({ base = "" }: { base?: string }) {
  const [text, setText] = useState<string>("");

  async function fetchBadge() {
    try {
      const res = await fetch(`${base}/assets/layout.json`, { cache: "no-store" });
      if (!res.ok) return;
      const j: LayoutData = await res.json();
      const dt = j?.generated_at ? new Date(j.generated_at * 1000) : null;
      const when = dt ? dt.toLocaleString() : "unknown";
      const featuredCount = Array.isArray(j?.sections?.featured) ? j.sections.featured.length : 0;
      setText(`${when} — preset=${j?.preset ?? "default"} — featured=${featuredCount}`);
    } catch (e) {
      console.error("Failed to load layout.json:", e);
    }
  }

  useEffect(() => {
    fetchBadge();
    
    // Listen for layout update events from "Run Now" button
    const handler = () => {
      // Wait a bit for backend to finish writing layout.json
      setTimeout(() => fetchBadge(), 500);
    };
    window.addEventListener("siteagent:layout:updated", handler);
    
    return () => window.removeEventListener("siteagent:layout:updated", handler);
  }, [base]);

  if (!text) return null;

  return (
    <span
      data-testid="last-run-badge"
      className="inline-flex items-center px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-600 text-xs bg-white dark:bg-gray-800"
    >
      Last optimized: {text}
    </span>
  );
}
