import React, { useEffect, useState } from "react";
import { adminHeaders } from "@/lib/adminHeaders";

interface AgentTask {
  id: number;
  task: string;
  run_id: string;
  status: string;
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
  outputs_uri?: string;
  approval_state?: string;
  approver?: string;
  approval_note?: string;
  log_excerpt?: string;
}

interface AgentTaskListOut {
  items: AgentTask[];
  next_cursor?: string | null;
}

export default function OpsAgents() {
  const [rows, setRows] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [since, setSince] = useState<string>(() => {
    // default: last 7 days
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 19); // 'YYYY-MM-DDTHH:mm:ss'
  });
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [taskFilterRaw, setTaskFilterRaw] = useState<string>(""); // comma-separated
  const API_BASE = (window as any).__API_BASE__ || import.meta.env.VITE_API_BASE || "/api";

  // Parse URL query params (since, status[], task)
  const parseURL = () => {
    const u = new URL(window.location.href);
    const sp = u.searchParams;
    const qSince = sp.get("since") || "";
    const qStatus = sp.getAll("status");
    const repeatedTasks = sp.getAll("task");
    const qTask = repeatedTasks.length ? repeatedTasks.join(", ") : (sp.get("tasks") || "");
    return { qSince, qStatus, qTask };
  };

  // Write current filters to URL (no history spam)
  const writeURL = (opts?: { resetCursor?: boolean }) => {
    const u = new URL(window.location.href);
    const sp = new URLSearchParams();
    if (since) sp.set("since", new Date(since).toISOString());
    for (const s of statusFilter) sp.append("status", s);
    const tasks = taskFilterRaw.split(",").map((t) => t.trim()).filter(Boolean);
    for (const t of tasks) sp.append("task", t);
    if (!opts?.resetCursor && cursor) sp.set("cursor", cursor);
    u.search = sp.toString();
    window.history.replaceState({}, "", u.toString());
  };

  function buildParams(extra?: Record<string, string | string[] | undefined>) {
    const params = new URLSearchParams();
    params.set("limit", "50");
    if (since) params.set("since", new Date(since).toISOString());
    if (cursor) params.set("cursor", cursor);
    // status (multi)
    for (const s of statusFilter) params.append("status", s);
    // task (multi): from comma list
    const tasks = taskFilterRaw.split(",").map((s) => s.trim()).filter(Boolean);
    for (const t of tasks) params.append("task", t);
    // extras
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
        else if (v) params.set(k, v);
      }
    }
    return params;
  }

  async function fetchPage(opts: { reset?: boolean } = {}) {
    if (opts.reset) {
      setLoading(true);
      setCursor(null);
      setNextCursor(null);
      setRows([]);
      writeURL({ resetCursor: true });
    }
    const url = `${API_BASE}/agents/tasks/paged?` + buildParams().toString();
    const r = await fetch(url);
    const data: AgentTaskListOut = await r.json();
    setRows((prev) => [...prev, ...data.items]);
    setNextCursor(data.next_cursor ?? null);
    setLoading(false);
  }

  useEffect(() => {
    // Parse URL to restore filter state on mount
    const { qSince, qStatus, qTask } = parseURL();
    if (qSince) {
      try {
        const d = new Date(qSince);
        if (!isNaN(d.getTime())) {
          setSince(d.toISOString().slice(0, 19));
        }
      } catch {}
    }
    if (qStatus?.length) setStatusFilter(qStatus);
    if (qTask) setTaskFilterRaw(qTask);
    fetchPage({ reset: true }).catch(() => setLoading(false));
  }, []); // Run once on mount

  // Sync URL whenever filters change
  useEffect(() => {
    writeURL({ resetCursor: true });
  }, [since, statusFilter, taskFilterRaw]);

  function statusBadge(status: string) {
    const base = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border";
    switch (status.toLowerCase()) {
      case "queued":
        return <span className={`${base} border-sky-700 bg-sky-900/30 text-sky-200`}>queued</span>;
      case "running":
        return <span className={`${base} border-indigo-700 bg-indigo-900/30 text-indigo-200`}>running</span>;
      case "awaiting_approval":
        return <span className={`${base} border-amber-700 bg-amber-900/30 text-amber-200`}>awaiting approval</span>;
      case "succeeded":
        return <span className={`${base} border-emerald-700 bg-emerald-900/30 text-emerald-200`}>succeeded</span>;
      case "failed":
        return <span className={`${base} border-rose-700 bg-rose-900/30 text-rose-200`}>failed</span>;
      case "skipped":
        return <span className={`${base} border-zinc-700 bg-zinc-900/30 text-zinc-200`}>skipped</span>;
      default:
        return <span className={`${base} border-neutral-700 bg-neutral-900/30 text-neutral-300`}>{status}</span>;
    }
  }

  function formatDuration(ms: number | undefined) {
    if (!ms) return "—";
    if (ms < 1000) return `${ms}ms`;
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const remSec = sec % 60;
    return `${min}m ${remSec}s`;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Agent Runs</h1>
      <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3 items-end">
        <label className="text-sm text-zinc-300">
          Since (UTC)
          <input
            data-testid="since-input"
            type="datetime-local"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="ml-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm"
          />
        </label>
        <div className="text-sm text-zinc-300">
          Presets
          <div className="mt-1 flex gap-2">
            <button
              data-testid="preset-today"
              onClick={() => {
                const now = new Date();
                const utcToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
                setSince(utcToday.toISOString().slice(0, 19));
                fetchPage({ reset: true });
              }}
              className="px-2 py-1 rounded border bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-xs"
            >
              Today
            </button>
            <button
              data-testid="preset-7d"
              onClick={() => {
                const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                setSince(d.toISOString().slice(0, 19));
                fetchPage({ reset: true });
              }}
              className="px-2 py-1 rounded border bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-xs"
            >
              7d
            </button>
            <button
              data-testid="preset-30d"
              onClick={() => {
                const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                setSince(d.toISOString().slice(0, 19));
                fetchPage({ reset: true });
              }}
              className="px-2 py-1 rounded border bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-xs"
            >
              30d
            </button>
          </div>
        </div>
        <div className="text-sm text-zinc-300">
          Status
          <div className="mt-1 flex flex-wrap gap-2">
            {["queued", "running", "succeeded", "failed", "awaiting_approval", "skipped"].map((s) => {
              const active = statusFilter.includes(s);
              return (
                <button
                  data-testid={`status-pill-${s}`}
                  key={s}
                  onClick={() => {
                    setStatusFilter((prev) => (active ? prev.filter((x) => x !== s) : [...prev, s]));
                  }}
                  className={`px-2 py-1 rounded border text-xs ${
                    active ? "bg-zinc-700 border-zinc-600" : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
        <label className="text-sm text-zinc-300">
          Tasks (comma-separated)
          <input
            data-testid="task-input"
            placeholder="seo.validate, code.review, dx.integrate"
            value={taskFilterRaw}
            onChange={(e) => setTaskFilterRaw(e.target.value)}
            className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm"
          />
        </label>
        <div className="flex gap-2">
          <button
            data-testid="apply-btn"
            onClick={() => fetchPage({ reset: true })}
            className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
          >
            Apply
          </button>
          <button
            data-testid="reset-btn"
            onClick={() => {
              setStatusFilter([]);
              setTaskFilterRaw("");
              fetchPage({ reset: true });
            }}
            className="px-3 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-sm border border-zinc-800"
          >
            Reset
          </button>
          {/* Test-friendly CSV link (deterministic href; no popup needed) */}
          <a
            data-testid="csv-link"
            href={`${API_BASE}/agents/tasks/paged.csv?${buildParams({ limit: "1000" }).toString()}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto px-3 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-sm border border-zinc-800"
            title="Download CSV with current filters"
          >
            Download CSV
          </a>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="text-zinc-400">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-zinc-800">
            <thead className="bg-zinc-900/50">
              <tr>
                <th className="px-3 py-2 text-left">Task</th>
                <th className="px-3 py-2 text-left">Run ID</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Approver</th>
                <th className="px-3 py-2 text-left">Note</th>
                <th className="px-3 py-2 text-left">Started</th>
                <th className="px-3 py-2 text-left">Duration</th>
                <th className="px-3 py-2 text-left">Output</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-zinc-800 hover:bg-zinc-900/30">
                  <td className="px-3 py-2">{row.task}</td>
                  <td className="px-3 py-2 text-xs text-zinc-400">{row.run_id}</td>
                  <td className="px-3 py-2">{statusBadge(row.status)}</td>
                  <td className="px-3 py-2 text-zinc-300 text-xs">{row.approver || "—"}</td>
                  <td className="px-3 py-2 text-zinc-400 text-xs max-w-[260px] truncate" title={row.approval_note || ""}>
                    {row.approval_note || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-400">
                    {row.started_at ? new Date(row.started_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-400">{formatDuration(row.duration_ms)}</td>
                  <td className="px-3 py-2">
                    {row.outputs_uri ? (
                      <a
                        href={row.outputs_uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-zinc-500 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {row.status === "awaiting_approval" ? (
                      <div className="flex gap-2">
                        <button
                          className="px-2 py-1 text-xs rounded bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-200"
                          onClick={async () => {
                            const note = window.prompt("Approval note (optional):") || "";
                            const res = await fetch(`${API_BASE}/agents/tasks/${row.id}/approve?note=${encodeURIComponent(note)}`, {
                              method: "POST",
                              headers: adminHeaders(),
                            });
                            if (res.ok) {
                              const updated = await res.json();
                              setRows(prev => prev.map(x => x.id === row.id ? updated : x));
                            } else {
                              alert("Approve failed");
                            }
                          }}
                        >
                          Approve
                        </button>
                        <button
                          className="px-2 py-1 text-xs rounded bg-rose-700/30 hover:bg-rose-700/50 text-rose-200"
                          onClick={async () => {
                            const note = window.prompt("Reject reason:") || "";
                            const res = await fetch(`${API_BASE}/agents/tasks/${row.id}/reject?note=${encodeURIComponent(note)}`, {
                              method: "POST",
                              headers: adminHeaders(),
                            });
                            if (res.ok) {
                              const updated = await res.json();
                              setRows(prev => prev.map(x => x.id === row.id ? updated : x));
                            } else {
                              alert("Reject failed");
                            }
                          }}
                        >
                          Reject
                        </button>
                        <button
                          className="px-2 py-1 text-xs rounded bg-zinc-700/30 hover:bg-zinc-700/50 text-zinc-300"
                          onClick={async () => {
                            const note = window.prompt("Cancel note (optional):") || "";
                            const res = await fetch(`${API_BASE}/agents/tasks/${row.id}/cancel?note=${encodeURIComponent(note)}`, {
                              method: "POST",
                              headers: adminHeaders(),
                            });
                            if (res.ok) {
                              const updated = await res.json();
                              setRows(prev => prev.map(x => x.id === row.id ? updated : x));
                            } else {
                              alert("Cancel failed");
                            }
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className="text-zinc-500 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-zinc-400" colSpan={9}>
                    No runs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4">
        {nextCursor ? (
          <button
            data-testid="load-more"
            onClick={() => {
              setCursor(nextCursor);
              fetchPage().catch((e) => console.error("Failed to fetch:", e));
            }}
            className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700"
          >
            Load more
          </button>
        ) : !loading && rows.length > 0 ? (
          <span className="text-zinc-500 text-sm">End of results</span>
        ) : null}
      </div>
    </div>
  );
}
