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

  useEffect(() => {
    (async () => {
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
    })();
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
