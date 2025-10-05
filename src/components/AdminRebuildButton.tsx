import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ExecResult =
  | { ok: true; exit_code: number; duration_ms: number; stdout_tail?: string; stderr_tail?: string }
  | { ok: false; error: string };

async function getDbPath(base = ""): Promise<string | null> {
  try {
    const r = await fetch(`${base}/api/ready`);
    const j = await r.json();
    return j?.rag?.db ?? null;
  } catch { return null; }
}

export function AdminRebuildButton({ base = "" }: { base?: string }) {
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string>("");
  const [db, setDb] = React.useState<string | null>(null);

  React.useEffect(() => { getDbPath(base).then(setDb); }, [base]);

  async function run() {
    if (busy) return;
    const confirmed = window.confirm(`Rebuild RAG index?\nDB: ${db ?? "(auto-detect)"}\nThis will run scripts/rag-build-index.ps1`);
    if (!confirmed) return;
    setBusy(true); setMsg("Starting…");

    const body = {
      name: "run_script",
      args: {
        script: "scripts/rag-build-index.ps1",
        args: db ? ["-DbPath", db] : [],
        timeout_s: 900
      }
    };

    try {
      const r = await fetch(`${base}/api/tools/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j: ExecResult & any = await r.json();
      if (!j.ok) {
        setMsg(`❌ ${j.error ?? "failed"}`);
      } else {
        const tail = (j.stdout_tail || j.stderr_tail || "").trim();
        setMsg(`✅ exit ${j.exit_code} in ${j.duration_ms}ms\n${tail.slice(-1000)}`);
      }
    } catch (e: any) {
      setMsg(`❌ network error: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-auto flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-white/90 p-3 shadow-lg backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">Admin</Badge>
        <span className="text-xs text-slate-600 dark:text-slate-300">Rebuild RAG index</span>
      </div>
      <Button
        disabled={busy}
        onClick={run}
        className="h-8 px-3 text-xs"
        data-testid="admin-rebuild-run"
      >
        {busy ? "Running…" : "Run rag-build-index.ps1"}
      </Button>
      {db && <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[260px]">DB: {db}</div>}
      {msg && (
        <pre className="mt-1 max-h-40 w-[320px] overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
{msg}
        </pre>
      )}
    </div>
  );
}
