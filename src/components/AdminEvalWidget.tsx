import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
interface HistoryItem { ts: string; ratio: number; pass: number; total: number }
interface HistoryResp { ok: boolean; items: any[]; count: number }
interface Summary { ratio: number; pass: number; total: number }
interface RunResp { ok: boolean; summary?: Summary | any; error?: string }

function toShort(ts: string) {
  try { return new Date(ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); } catch { return ts as any; }
}

export function AdminEvalWidget({ base = "" }: { base?: string }) {
  const [busy, setBusy] = React.useState(false);
  const [hist, setHist] = React.useState<HistoryItem[]>([]);
  const [last, setLast] = React.useState<HistoryItem | null>(null);
  const [lastDetail, setLastDetail] = React.useState<any | null>(null);
  const [msg, setMsg] = React.useState("");
  const [runSet, setRunSet] = React.useState<"baseline"|"plan"|"regression"|"full">("baseline");
  const [showAllFails, setShowAllFails] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);

  async function load() {
    try {
      const r: HistoryResp = await (await fetch(`${base}/api/eval/history?limit=24`)).json();
      const raw = (r.items || []);
      const items: HistoryItem[] = raw.map((x: any) => ({
        ts: x.ts, ratio: Number(x.ratio || 0), pass: x.pass, total: x.total
      }));
      setHist(items);
      setLast(items[items.length - 1] || null);
      setLastDetail(raw[raw.length - 1] || null);
    } catch {}
  }
  React.useEffect(() => { load(); }, []);
  React.useEffect(() => {
    // collapse on new run by default
    setShowAllFails(false);
  }, [lastDetail?.ts]);

  async function runEval() {
    setBusy(true); setMsg("");
    try {
      const files =
        runSet === "baseline" ? ["evals/baseline.jsonl"] :
        runSet === "plan" ? ["evals/tool_planning.jsonl"] :
        runSet === "regression" ? ["evals/regression.jsonl"] :
        ["evals/baseline.jsonl","evals/tool_planning.jsonl","evals/regression.jsonl"];
      const r: RunResp = await (await fetch(`${base}/api/eval/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, fail_under: 0.67 })
      })).json();
      if (!r.ok) { setMsg(`❌ ${r.error || "eval failed"}`); }
      else {
        const s = r.summary || {};
        setMsg(`✅ pass ${s.pass}/${s.total} · ratio ${s.ratio}`);
      }
    } catch (e: any) {
      setMsg(`❌ ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
      load();
    }
  }

  const ratio = last ? last.ratio : 0;
  const ratioPct = Math.round(100 * ratio);

  // Build a tiny sparkline path (0..100 width, 0..24 height)
  const points = hist.length ? hist.map((h, i) => {
    const x = (i / Math.max(1, hist.length - 1)) * 100;
    const y = (1 - Math.max(0, Math.min(1, h.ratio))) * 24; // invert
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }) : [];
  const d = points.length ? `M ${points[0]} L ${points.slice(1).join(" ")}` : "";

  return (
    <div className="pointer-events-auto flex w-[360px] flex-col gap-2 rounded-xl border border-slate-200/70 bg-white/90 p-3 shadow-lg backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">Admin</Badge>
        <span className="text-xs text-slate-600 dark:text-slate-300">Eval</span>
        <div className="ml-auto flex items-center gap-2">
          <Badge className={ratio >= 0.67 ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}>
            {ratioPct}%
          </Badge>
          <Select value={runSet} onValueChange={(v: string) => setRunSet(v as any)}>
            <SelectTrigger data-testid="admin-eval-select" className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Choose set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="baseline">Baseline</SelectItem>
              <SelectItem value="plan">Planning</SelectItem>
              <SelectItem value="regression">Regression</SelectItem>
              <SelectItem value="full">Full (all)</SelectItem>
            </SelectContent>
          </Select>
          <Button data-testid="admin-eval-run" onClick={runEval} disabled={busy} className="h-8 px-3 text-xs">
            {busy ? "Running…" : "Run eval"}
          </Button>
        </div>
      </div>

      <div className="h-24 w-full">
        <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <linearGradient id="evalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="100" height="24" fill="url(#evalGrad)" opacity="0.08" />
          {d && (
            <path d={d} fill="none" stroke="#10b981" strokeWidth="1.5" />
          )}
        </svg>
      </div>

      {last && (
        <div className="text-[11px] text-slate-600 dark:text-slate-300">
          last: {last.pass}/{last.total} · {new Date(last.ts).toLocaleString()}
        </div>
      )}
      {lastDetail && Number(lastDetail.ratio || 0) < 0.67 && Array.isArray(lastDetail.results) && (() => {
        const failObjs = (lastDetail.results as any[]).filter((r: any) => r && r.ok === false);
        const fails = failObjs.map((r: any) => r?.id).filter(Boolean);
        if (!fails.length) return null;
        const visible = showAllFails ? fails : fails.slice(0,3);
        return (
          <div className="relative text-[11px] text-rose-700 dark:text-rose-300">
            failing: {visible.join(", ")}
            {fails.length > 3 && (
              <button type="button" onClick={() => setShowAllFails(v => !v)} className="ml-2 underline hover:no-underline">
                {showAllFails ? "Show less" : `Show more (${fails.length - 3})`}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDetails(v => !v)}
              className="ml-3 rounded border border-rose-200/60 bg-rose-50/40 px-2 py-0.5 text-rose-800 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
            >
              Details
            </button>
            {showDetails && (
              <div className="absolute right-0 z-[10000] mt-1 max-h-48 w-[320px] overflow-auto rounded-md border border-slate-200/70 bg-white p-2 text-[11px] shadow-xl dark:border-slate-700/70 dark:bg-slate-900">
                <div className="mb-1 font-semibold text-slate-700 dark:text-slate-200">Failing cases</div>
                <ul className="space-y-2">
                  {failObjs.map((r: any, i: number) => (
                    <li key={(r.id || i) as React.Key} className="rounded bg-rose-50/60 p-2 dark:bg-rose-950/30">
                      <div className="font-medium text-rose-800 dark:text-rose-200">{r.id || `(case ${i+1})`} <span className="ml-2 text-[10px] text-slate-500">{r.type}</span></div>
                      {Array.isArray(r.errors) && r.errors.length > 0 ? (
                        <ul className="mt-1 list-disc pl-5 text-rose-700 dark:text-rose-300">
                          {r.errors.map((e: any, j: number) => (
                            <li key={j}>{String(e)}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-1 text-slate-500">(no error details)</div>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 text-right">
                  <button type="button" onClick={() => setShowDetails(false)} className="rounded bg-slate-100 px-2 py-1 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Close</button>
                </div>
              </div>
            )}
          </div>
        );
      })()}
      {msg && (
        <pre className="max-h-32 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
{msg}
        </pre>
      )}
    </div>
  );
}
