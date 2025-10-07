import { useEffect, useState } from "react";

interface ABSuggestion {
  better: "A" | "B";
  ctr_a: number;
  ctr_b: number;
  hint: Record<string, number>;
}

export function ABAnalyticsPanel({ base = "" }: { base?: string }) {
  const [data, setData] = useState<ABSuggestion | null>(null);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${base}/agent/ab/suggest`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "failed";
        setErr(msg);
      }
    })();
  }, [base]);

  if (err)
    return (
      <div data-testid="ab-analytics" className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
        AB: {err}
      </div>
    );

  if (!data)
    return (
      <div data-testid="ab-analytics" className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
        AB: loading…
      </div>
    );

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  
  return (
    <div data-testid="ab-analytics" className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-2 bg-white dark:bg-gray-800">
      <div className="text-base font-semibold">A/B Analytics</div>
      <div className="text-sm">
        Winner (so far): <span className="font-mono font-semibold">{data.better}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs opacity-70">CTR A</div>
          <div data-testid="ab-ctr-a" className="text-lg font-semibold">
            {pct(data.ctr_a)}
          </div>
        </div>
        <div>
          <div className="text-xs opacity-70">CTR B</div>
          <div data-testid="ab-ctr-b" className="text-lg font-semibold">
            {pct(data.ctr_b)}
          </div>
        </div>
      </div>
      <div className="text-xs opacity-70">
        Suggested weight nudge:{" "}
        {Object.entries(data.hint).map(([k, v]) => (
          <span key={k} className="mr-2 font-mono">
            {k}
            {v >= 0 ? "+" : ""}
            {(v * 100).toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  );
}
