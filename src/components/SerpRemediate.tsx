import React, { useEffect, useMemo, useState } from "react";
import { inputValue, inputChecked } from "@/utils/event-helpers";

interface PlanItem {
  action: string;
  url: string;
  reason?: string;
  suggestions?: string[];
  inputs?: Record<string, unknown>;
}
interface RemediateResp {
  day: string;
  count: number;
  plan: PlanItem[];
  artifacts: { actions: string };
  dispatched: number;
}

export default function SerpRemediate() {
  const [limit, setLimit] = useState(10);
  const [dispatch, setDispatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [res, setRes] = useState<RemediateResp | null>(null);

  const endpoint = useMemo(() => "/agent/seo/serp/remediate", []);

  async function run() {
    setBusy(true); setMsg(""); setRes(null);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ limit, dry_run: !dispatch })
      });
      if (!r.ok) {
        const t = await r.text().catch(()=> "");
        throw new Error(`${r.status} ${r.statusText} ${t}`);
      }
      const j: RemediateResp = await r.json();
      setRes(j);
      setMsg(`Planned ${j.count} action(s).${dispatch ? ` Dispatched: ${j.dispatched}.` : ""}`);
    } catch (e:any) {
      setMsg(`Failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border p-4 bg-white/70 dark:bg-zinc-900/60 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-lg font-semibold">SERP Remediation</h3>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="text-sm">Limit
          <input type="number" min={1} max={50} value={limit}
                 onChange={(e) => setLimit(Number(inputValue(e)))}
                 className="ml-2 w-20 border rounded px-2 py-1 text-sm"/>
        </label>
        <label className="text-sm inline-flex items-center gap-2">
          <input type="checkbox" checked={dispatch} onChange={(e) => setDispatch(inputChecked(e))}/>
          Dispatch to rewrite endpoint
        </label>
        <button onClick={run} disabled={busy} className="px-3 py-1.5 rounded-md border">
          {busy ? "Running…" : "Plan remediation"}
        </button>
      </div>
      {msg && <div className="text-xs opacity-70 mb-2" data-testid="serp-remediate-msg">{msg}</div>}
      {res?.plan?.length ? (
        <div className="max-h-64 overflow-auto rounded border bg-white/60 dark:bg-zinc-900/40">
          <table className="w-full text-sm">
            <thead className="text-left sticky top-0 bg-white/80 dark:bg-zinc-900/80">
              <tr><th className="p-2">URL</th><th className="p-2">Reason</th><th className="p-2">Suggestions</th></tr>
            </thead>
            <tbody>
              {res.plan.map((p,i)=>(
                <tr key={i} className="border-t">
                  <td className="p-2 align-top"><a className="underline" href={p.url} target="_blank" rel="noreferrer">{p.url}</a></td>
                  <td className="p-2 align-top">{p.reason}</td>
                  <td className="p-2 align-top">{(p.suggestions||[]).join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
