import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SeoJsonLdPanel from "./SeoJsonLdPanel";
import SerpLatest from "./SerpLatest";
import SerpRemediate from "./SerpRemediate";
import BehaviorMetricsPanel from "./BehaviorMetricsPanel";
import AgentsApprovalPanel from "./AgentsApprovalPanel";
import AgentsQuickRuns from "./AgentsQuickRuns";
import OpsAgents from "./OpsAgents";
import OverlayRecentRuns from "./OverlayRecentRuns";
import OverlayApprovalBadge from "./OverlayApprovalBadge";
import { inputValue, inputChecked } from "@/utils/event-helpers";

interface ToolsList {
  ok: boolean;
  allow: boolean;
  allowlist: string[];
  tools: { name: string; desc: string; dangerous?: boolean; schema?: any }[];
}
interface Ready { ok: boolean; rag?: { db?: string } }
interface GitDirty { total?: number; added?: number; modified?: number; deleted?: number; untracked?: number }
interface GitStatus { ok: boolean; branch?: string; ahead?: number; behind?: number; dirty?: GitDirty }

export function AdminToolsPanel({ base = "" }: { base?: string }) {
  const [tools, setTools] = React.useState<ToolsList | null>(null);
  const [db, setDb] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string>("");

  const [script, setScript] = React.useState("scripts/rag-build-index.ps1");
  const [useDetectedDb, setUseDetectedDb] = React.useState(true);
  const [dbPath, setDbPath] = React.useState("");
  const [git, setGit] = React.useState<GitStatus | null>(null);

  async function refresh() {
    try {
      const j: ToolsList = await (await fetch(`${base}/api/tools`)).json();
      setTools(j);
    } catch {}
    try {
      const r: Ready = await (await fetch(`${base}/api/ready`)).json();
      const p = r?.rag?.db || "";
      setDb(p);
      if (useDetectedDb) setDbPath(p);
    } catch {}
    try {
      const r = await fetch(`${base}/api/tools/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "git_status" })
      });
      const j: GitStatus = await r.json();
      setGit(j);
    } catch {}
  }

  React.useEffect(() => { refresh(); }, []);
  React.useEffect(() => { if (useDetectedDb) setDbPath(db); }, [db, useDetectedDb]);

  const dangerousNames = (tools?.tools || [])
    .filter(t => (t as any).dangerous)
    .map(t => t.name);

  // Derive pre-flight classification (for color cue reuse)
  const allow = !!tools?.allow;
  const allowlist = tools?.allowlist || [];
  const hasScript = !!script?.trim();
  const allowlisted = hasScript && allowlist.some(p => p === script);
  const behindN = git?.behind ?? 0;
  const dirtyN = git?.dirty?.total ?? 0;
  const hardBlock = (!allow) || (!allowlisted);
  const softBlock = !hardBlock && ((behindN > 0) || (dirtyN > 0));
  const preflightCls = hardBlock
    ? 'text-rose-700 dark:text-rose-300'
    : (softBlock ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300');

  async function dryRun() {
    setMsg(""); setBusy(true);
    try {
      const body = {
        name: "run_script",
        args: {
          script,
          args: dbPath ? ["-DbPath", dbPath] : [],
          dry_run: true,
        },
      };
      const r = await fetch(`${base}/api/tools/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j?.ok) {
        const cmd = Array.isArray(j.cmd) ? j.cmd.join(" ") : JSON.stringify(j.cmd);
        setMsg(`✅ DRY-RUN OK\n${cmd}`);
      } else {
        setMsg(`❌ ${j?.error || "failed"}`);
      }
    } catch (e: any) {
      setMsg(`❌ ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function runDangerous() {
    setMsg(""); setBusy(true);
    try {
      const ok = window.confirm(
        "This will execute the script (no dry-run).\n" +
        "Requires ALLOW_TOOLS=1 and allowlisted script.\n" +
        "If pre-flight guard is enabled, repo must be clean and not behind.\n\nProceed?"
      );
      if (!ok) { setBusy(false); return; }

      const body = {
        name: "run_script",
        args: {
          script,
          args: dbPath ? ["-DbPath", dbPath] : [],
          timeout_s: 900
        },
      };
      const r = await fetch(`${base}/api/tools/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j?.ok) {
        const tail = (j.stdout_tail || j.stderr_tail || "").toString().trim();
        setMsg(`✅ exit ${j.exit_code ?? 0} in ${j.duration_ms ?? "?"}ms\n${tail.slice(-1000)}`);
      } else {
        setMsg(`❌ ${j?.error || "failed"}`);
      }
    } catch (e: any) {
      setMsg(`❌ ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="admin-tools-panel" className="pointer-events-auto flex w-[360px] max-h-[80vh] flex-col gap-2 rounded-xl border border-slate-200/70 bg-white/90 p-3 shadow-lg backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80 overflow-y-auto">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">Admin</Badge>
        <span className="text-xs text-slate-600 dark:text-slate-300">Tools</span>
        {tools?.allow ? (
          <Badge className="ml-auto bg-emerald-600 text-white">gating: enabled</Badge>
        ) : (
          <Badge className="ml-auto bg-rose-600 text-white">gating: disabled</Badge>
        )}
      </div>

      {/* Pre-flight glimpse */}
      <div className="rounded-md border border-slate-200 p-2 text-xs dark:border-slate-700">
        <div className="mb-1 flex items-center gap-2 font-semibold">
          <span>Pre-flight</span>
          <span
            aria-label="Legend"
            role="note"
            className="cursor-help select-none rounded px-1.5 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-300/60 dark:text-slate-400 dark:ring-slate-600/60"
            title="Legend: Green — likely allowed; Amber — soft blockers (dirty/behind) may be overrideable; Red — hard blockers (gating off or script not allowlisted)."
          >?
          </span>
        </div>
        {git?.ok ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded border border-slate-300 px-1.5 py-0.5 dark:border-slate-700 ${preflightCls}`}>branch: {git.branch || "?"}</span>
            <span className={`rounded border border-slate-300 px-1.5 py-0.5 dark:border-slate-700 ${preflightCls}`}>dirty: {git.dirty?.total ?? 0}</span>
            <span className={`rounded border px-1.5 py-0.5 ${((git.behind ?? 0) > 0) ? 'border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-200' : 'border-slate-300 dark:border-slate-700'}`}>behind: {git.behind ?? 0}</span>
            <span className={`rounded border px-1.5 py-0.5 ${((git.ahead ?? 0) > 0) ? 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-200' : 'border-slate-300 dark:border-slate-700'}`}>ahead: {git.ahead ?? 0}</span>
          </div>
        ) : (
          <div className="text-slate-500">status unavailable</div>
        )}
        {/* Why blocked hint */}
        <div className="mt-2 text-[11px]" title="Determined from gating, allowlist, selected script, and git status">
          {(() => {
            const allow = !!tools?.allow;
            const allowlist = tools?.allowlist || [];
            const hasScript = !!script?.trim();
            const allowlisted = hasScript && allowlist.some(p => p === script);
            const behind = git?.behind ?? 0;
            const dirty = git?.dirty?.total ?? 0;
            const reasons: string[] = [];
            if (!allow) reasons.push('gating disabled (ALLOW_TOOLS=0)');
            if (!allowlisted) reasons.push('script not in ALLOW_SCRIPTS');
            if (behind > 0) reasons.push('repo behind remote');
            if (dirty > 0) reasons.push('repo dirty');
            const hard = (!allow) || (!allowlisted);
            const soft = !hard && ((behind > 0) || (dirty > 0));
            const cls = hard
              ? 'text-rose-700 dark:text-rose-300'
              : (soft ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300');
            const text = reasons.length === 0
              ? 'Looks good — run should be allowed.'
              : 'May be blocked: ' + reasons.join(', ') + '.';
            return <span className={cls}>{text}</span>;
          })()}
        </div>
      </div>

      {/* Allowlist */}
      <div className="rounded-md border border-slate-200 p-2 text-xs dark:border-slate-700">
        <div className="mb-1 font-semibold">Allowlist</div>
        <div className="flex flex-wrap gap-1.5">
          {(tools?.allowlist || []).length
            ? tools!.allowlist.map(a => (
                <span key={a} className="rounded border border-slate-300 px-1.5 py-0.5 dark:border-slate-700">{a}</span>
              ))
            : <span className="text-slate-500">empty (using tool defaults)</span>}
        </div>
      </div>

      {/* Dangerous tools list */}
      {dangerousNames.length > 0 && (
        <div className="rounded-md border border-slate-200 p-2 text-xs dark:border-slate-700">
          <div className="mb-1 font-semibold">Dangerous tools</div>
          <div className="flex flex-wrap gap-1.5">
            {dangerousNames.map(n => (
              <span key={n} className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                {n}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dry-run runner */}
      <div className="rounded-md border border-slate-200 p-2 text-xs dark:border-slate-700">
        <div className="mb-2 font-semibold">Dry-run run_script</div>

        {/* Preset selector */}
        {(tools?.allowlist?.length ?? 0) > 0 && (
          <div className="mb-2 flex items-center gap-2">
            <label className="text-[11px] text-slate-500">preset</label>
            <select
              className="h-8 rounded border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              value={script}
              onChange={(e) => setScript(inputValue(e))}
            >
              {tools!.allowlist.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}

        <label className="mb-1 block text-[11px] text-slate-500">script path</label>
        <Input
          data-testid="tools-script-input"
          value={script}
          onChange={(e) => setScript(inputValue(e))}
          placeholder="scripts/rag-build-index.ps1"
          className="mb-2"
        />

        <div className="mb-2 flex items-center gap-2">
          <input
            id="useDetected"
            type="checkbox"
            className="h-4 w-4"
            checked={useDetectedDb}
            onChange={(e) => setUseDetectedDb(inputChecked(e))}
          />
          <label htmlFor="useDetected" className="text-[11px] text-slate-600 dark:text-slate-300">
            Use detected DB ({db || "none"})
          </label>
        </div>

        {!useDetectedDb && (
          <>
            <label className="mb-1 block text-[11px] text-slate-500">DB path</label>
            <Input
              data-testid="tools-db-input"
              value={dbPath}
              onChange={(e) => setDbPath(inputValue(e))}
              placeholder="D:/path/to/rag.sqlite"
              className="mb-2"
            />
          </>
        )}

        <div className="flex gap-2">
          <Button data-testid="tools-dryrun" onClick={dryRun} disabled={busy} className="h-8 px-3 text-xs">
            {busy ? "Working…" : "Dry-run"}
          </Button>
          <Button
            data-testid="tools-run"
            onClick={runDangerous}
            disabled={busy}
            className="h-8 px-3 text-xs bg-rose-600 hover:bg-rose-700 text-white"
          >
            {busy ? "Working…" : "Run (dangerous)"}
          </Button>
          <Button onClick={refresh} className="h-8 px-3 text-xs border border-slate-300 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50">
            Refresh
          </Button>
        </div>

        {msg && (
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
{msg}
          </pre>
        )}
      </div>

      {/* === SEO: JSON-LD Panel === */}
      <section aria-labelledby="seo-jsonld-title" data-testid="admin-seo-section" className="mt-6">
        <h2 id="seo-jsonld-title" className="text-xl font-semibold mb-3">SEO</h2>
        <SeoJsonLdPanel />
      </section>

      {/* === SEO: SERP & Indexing === */}
      <section aria-labelledby="seo-serp-title" className="mt-4">
        <h2 id="seo-serp-title" className="text-xl font-semibold mb-2">Indexing & SERP</h2>
        <div className="grid gap-3">
          <SerpLatest />
          <SerpRemediate />
        </div>
      </section>

      {/* === Behavior Metrics (Privileged) === */}
      <section aria-labelledby="behavior-metrics-title" className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 id="behavior-metrics-title" className="text-xl font-semibold">
            Behavior Metrics
          </h2>
          <span className="text-xs text-neutral-500">
            14-day views / clicks / CTR / dwell & learned weights
          </span>
        </div>
        <BehaviorMetricsPanel />
      </section>

      {/* === Agent Orchestration === */}
      <section aria-labelledby="agents-title" className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <h2 id="agents-title" className="text-xl font-semibold">
            Agent Orchestration
          </h2>
          <OverlayApprovalBadge />
        </div>
        <div className="space-y-3">
          <AgentsQuickRuns onLaunched={(r) => console.debug("agents.run →", r)} />
          <AgentsApprovalPanel />

          {/* Recent Runs */}
          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-2">Recent runs</h3>
            <OverlayRecentRuns />
          </div>

          {/* Task History Viewer */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Task History</h3>
            <OpsAgents />
          </div>
        </div>
      </section>
    </div>
  );
}
