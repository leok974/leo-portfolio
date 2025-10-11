/**
 * OverlayRecentRuns - Compact Recent runs panel for Admin overlay
 *
 * Displays last 10 agent task runs with filters for agent, status, and time range.
 * Reuses the existing /agents/tasks/paged endpoint with limit=10.
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { adminHeaders } from "@/lib/adminHeaders";

interface AgentTask {
  id: number;
  task: string;
  run_id: string;
  status: string;
  started_at: string;
  duration_ms?: number;
  outputs_uri?: string;
  approver?: string;
  approval_note?: string;
}

const STATUSES = ["queued", "running", "awaiting_approval", "succeeded", "failed", "skipped"];

export default function OverlayRecentRuns() {
  const API_BASE = (window as any).__API_BASE__ || import.meta.env.VITE_API_BASE || "/api";
  const [items, setItems] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [agent, setAgent] = useState<string>("");       // task filter
  const [status, setStatus] = useState<string>("");     // single status
  const [sinceHrs, setSinceHrs] = useState<number>(24); // lookback

  const sinceIso = useMemo(() => {
    const d = new Date(Date.now() - sinceHrs * 60 * 60 * 1000);
    return d.toISOString();
  }, [sinceHrs]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "10", since: sinceIso });
      if (agent) params.append("task", agent);
      if (status) params.append("status", status);
      const r = await fetch(`${API_BASE}/agents/tasks/paged?${params.toString()}`);
      const data = await r.json();
      setItems(data.items || []);
    } catch (error) {
      console.error("Failed to load recent runs:", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, agent, status, sinceIso]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-3 border border-zinc-800 rounded-xl bg-zinc-950/70">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="text-sm">
          <label className="mr-2 text-zinc-300">Agent</label>
          <input
            data-testid="overlay-agent-input"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            placeholder="seo.validate, code.review…"
            className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-sm"
          />
        </div>
        <div className="text-sm">
          <label className="mr-2 text-zinc-300">Status</label>
          <select
            data-testid="overlay-status-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-sm"
          >
            <option value="">(any)</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm">
          <label className="mr-2 text-zinc-300">Since</label>
          <select
            data-testid="overlay-since-select"
            value={String(sinceHrs)}
            onChange={(e) => setSinceHrs(Number(e.target.value))}
            className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-sm"
          >
            <option value="6">6h</option>
            <option value="12">12h</option>
            <option value="24">24h</option>
            <option value="72">72h</option>
            <option value="168">7d</option>
          </select>
        </div>
        <button
          data-testid="overlay-refresh"
          onClick={() => load()}
          className="ml-auto px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="text-zinc-300">
            <tr>
              <th className="text-left py-1 pr-3">Time</th>
              <th className="text-left py-1 pr-3">Agent</th>
              <th className="text-left py-1 pr-3">Status</th>
              <th className="text-left py-1 pr-3">Approver</th>
              <th className="text-left py-1 pr-3">Note</th>
              <th className="text-left py-1 pr-3">Duration</th>
              <th className="text-left py-1 pr-3">Output</th>
              <th className="text-left py-1 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t border-zinc-800">
                <td className="py-1 pr-3">{new Date(r.started_at).toLocaleString()}</td>
                <td className="py-1 pr-3">{r.task}</td>
                <td className="py-1 pr-3">
                  <span className="px-2 py-0.5 rounded-full bg-zinc-800">{r.status}</span>
                </td>
                <td className="py-1 pr-3">{r.approver || "—"}</td>
                <td className="py-1 pr-3 max-w-[140px] truncate" title={r.approval_note || ""}>
                  {r.approval_note || "—"}
                </td>
                <td className="py-1 pr-3">
                  {r.duration_ms ? `${Math.round(r.duration_ms / 1000)}s` : "—"}
                </td>
                <td className="py-1 pr-3 truncate max-w-[120px]">
                  {r.outputs_uri ? (
                    <a
                      className="text-blue-400 hover:underline"
                      href={r.outputs_uri}
                      target="_blank"
                      rel="noreferrer"
                    >
                      link
                    </a>
                  ) : (
                    <span className="text-zinc-500">—</span>
                  )}
                </td>
                <td className="py-1 pr-3">
                  {r.status === "awaiting_approval" ? (
                    <div className="flex gap-1">
                      <button
                        className="px-2 py-0.5 text-[11px] rounded bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-200"
                        onClick={async () => {
                          const note = window.prompt("Approval note (optional):") || "";
                          const res = await fetch(`${API_BASE}/agents/tasks/${r.id}/approve?note=${encodeURIComponent(note)}`, {
                            method: "POST",
                            headers: adminHeaders(),
                          });
                          if (res.ok) {
                            load();
                          } else {
                            alert("Approve failed");
                          }
                        }}
                      >
                        Approve
                      </button>
                      <button
                        className="px-2 py-0.5 text-[11px] rounded bg-rose-700/30 hover:bg-rose-700/50 text-rose-200"
                        onClick={async () => {
                          const note = window.prompt("Reject reason:") || "";
                          const res = await fetch(`${API_BASE}/agents/tasks/${r.id}/reject?note=${encodeURIComponent(note)}`, {
                            method: "POST",
                            headers: adminHeaders(),
                          });
                          if (res.ok) {
                            load();
                          } else {
                            alert("Reject failed");
                          }
                        }}
                      >
                        Reject
                      </button>
                      <button
                        className="px-2 py-0.5 text-[11px] rounded bg-zinc-700/30 hover:bg-zinc-700/50 text-zinc-300"
                        onClick={async () => {
                          const note = window.prompt("Cancel note (optional):") || "";
                          const res = await fetch(`${API_BASE}/agents/tasks/${r.id}/cancel?note=${encodeURIComponent(note)}`, {
                            method: "POST",
                            headers: adminHeaders(),
                          });
                          if (res.ok) {
                            load();
                          } else {
                            alert("Cancel failed");
                          }
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span className="text-zinc-500 text-[11px]">—</span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td className="py-4 text-zinc-400" colSpan={8}>
                  No recent runs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
