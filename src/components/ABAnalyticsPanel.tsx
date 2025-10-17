import { useEffect, useState } from "react";
import { inputValue, inputChecked } from "@/utils/event-helpers";
import { Button } from "@/components/ui/button";

interface ABSuggestion {
  better: "A" | "B";
  ctr_a: number;
  ctr_b: number;
  hint: Record<string, number>;
}

export function ABAnalyticsPanel({ base = "" }: { base?: string }) {
  const [data, setData] = useState<ABSuggestion | null>(null);
  const [err, setErr] = useState<string>("");
  const [preset, setPreset] = useState<string>("recruiter");
  const [running, setRunning] = useState(false);

  async function refreshLayoutMeta() {
    try {
      const res = await fetch(`${base}/assets/layout.json`, { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        if (j?.preset) setPreset(j.preset);
      }
    } catch (e) {
      console.error("Failed to refresh layout meta:", e);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await refreshLayoutMeta();
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

  async function runNow() {
    setRunning(true);
    try {
      const res = await fetch(`${base}/agent/act`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "layout.optimize", payload: { preset } }),
      });
      if (res.ok) {
        // Notify badge to refresh
        window.dispatchEvent(new CustomEvent("siteagent:layout:updated"));
        // Show success toast
        window.dispatchEvent(
          new CustomEvent("siteagent:toast", {
            detail: { message: `Layout optimized with ${preset} preset` },
          })
        );
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e) {
      console.error("Failed to run optimization:", e);
      window.dispatchEvent(
        new CustomEvent("siteagent:toast", {
          detail: { message: "Optimization failed" },
        })
      );
    } finally {
      setRunning(false);
    }
  }

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
  const winA = data.better === "A";
  const aCls = winA ? "text-lg font-bold" : "text-lg opacity-75";
  const bCls = !winA ? "text-lg font-bold" : "text-lg opacity-75";

  return (
    <div data-testid="ab-analytics" className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">A/B Analytics</div>
        <div className="flex gap-2 items-center">
          <select
            data-testid="preset-now-select"
            value={preset}
            onChange={(e) => setPreset(inputValue(e))}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800"
          >
            <option value="default">default</option>
            <option value="recruiter">recruiter</option>
            <option value="hiring_manager">hiring_manager</option>
          </select>
          <Button
            data-testid="run-now"
            disabled={running}
            onClick={runNow}
            className="px-3 py-1 h-auto text-xs"
          >
            {running ? "Running…" : "Run Now"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs opacity-70">CTR A</div>
          <div data-testid="ab-ctr-a" className={aCls}>
            {pct(data.ctr_a)}
          </div>
        </div>
        <div>
          <div className="text-xs opacity-70">CTR B</div>
          <div data-testid="ab-ctr-b" className={bCls}>
            {pct(data.ctr_b)}
          </div>
        </div>
      </div>

      <div className="text-xs opacity-70">
        Suggested nudge:{" "}
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
