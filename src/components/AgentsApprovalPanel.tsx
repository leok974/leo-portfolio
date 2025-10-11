import { useEffect, useRef, useState } from "react";
import AgentsStatusLegend from "./AgentsStatusLegend";

interface Task {
  task_id: string;
  agent: string;
  task: string;
  status: string;
  needs_approval: boolean;
  outputs_uri?: string;
  logs_tail?: string;
  updated_at?: string;
  created_at?: string;
}

export default function AgentsApprovalPanel() {
  const [taskId, setTaskId] = useState<string>("");
  const [task, setTask] = useState<Task | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const terminal = new Set(["succeeded", "failed", "rejected", "canceled"]);

  const canAbort = task && (task.status === "queued" || task.status === "running");

  function statusBadge(status?: string) {
    const base = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border";
    switch ((status || "").toLowerCase()) {
      case "queued": return <span className={`${base} border-sky-700 bg-sky-900/30 text-sky-200`}>queued</span>;
      case "running": return <span className={`${base} border-indigo-700 bg-indigo-900/30 text-indigo-200`}>running</span>;
      case "awaiting_approval": return <span className={`${base} border-amber-700 bg-amber-900/30 text-amber-200`}>awaiting approval</span>;
      case "succeeded": return <span className={`${base} border-emerald-700 bg-emerald-900/30 text-emerald-200`}>succeeded</span>;
      case "failed": return <span className={`${base} border-rose-700 bg-rose-900/30 text-rose-200`}>failed</span>;
      case "rejected": return <span className={`${base} border-rose-700 bg-rose-900/30 text-rose-200`}>rejected</span>;
      case "canceled": return <span className={`${base} border-zinc-700 bg-zinc-900/30 text-zinc-200`}>canceled</span>;
      default: return <span className={`${base} border-neutral-700 bg-neutral-900/30 text-neutral-300`}>{status || "unknown"}</span>;
    }
  }

  async function fetchStatus(id: string) {
    if (!id.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/agents/status?task_id=${encodeURIComponent(id)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch task: ${res.statusText}`);
      }
      const data = await res.json();
      setTask(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch task");
      setTask(null);
    } finally {
      setLoading(false);
    }
  }

  function stopPolling() {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling(id: string) {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      const res = await fetch(`/agents/status?task_id=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = await res.json();
      setTask(data);
      if (terminal.has(data.status)) stopPolling();
    }, 2000);
  }

  // Auto-load when a quick-run finishes
  useEffect(() => {
    function onLaunched(e: Event) {
      const detail = (e as CustomEvent).detail as { task_id: string };
      if (!detail?.task_id) return;
      setTaskId(detail.task_id);
      // fetch status immediately
      fetchStatus(detail.task_id);
      // start polling
      startPolling(detail.task_id);
    }
    window.addEventListener("agents:launched", onLaunched as EventListener);
    return () => window.removeEventListener("agents:launched", onLaunched as EventListener);
  }, []);

  // Keyboard: Enter = Load, Ctrl/Cmd+Enter = Approve
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!panelRef.current) return;
      const within = panelRef.current.contains(document.activeElement);
      if (!within) return;
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (task?.status === "awaiting_approval") void doApprove();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (taskId) void fetchStatus(taskId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [taskId, task]);

  // Also support deep links like /admin?task_id=UUID
  useEffect(() => {
    const tid = new URLSearchParams(window.location.search).get("task_id");
    if (tid) { setTaskId(tid); fetchStatus(tid); startPolling(tid); }
    return () => stopPolling();
  }, []);

  async function doApprove() {
    if (!taskId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/agents/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, note })
      });

      if (!res.ok) {
        throw new Error(`Approval failed: ${res.statusText}`);
      }

      await fetchStatus(taskId);
      setNote(""); // Clear note after approval
      // pull one more time in case status flips late
      if (taskId) startPolling(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setLoading(false);
    }
  }

  async function doReject() {
    if (!taskId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/agents/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, note })
      });

      if (!res.ok) {
        throw new Error(`Rejection failed: ${res.statusText}`);
      }

      await fetchStatus(taskId);
      setNote(""); // Clear note after rejection
      if (taskId) startPolling(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setLoading(false);
    }
  }

  async function doCancel() {
    if (!taskId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/agents/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, note })
      });

      if (!res.ok) {
        throw new Error(`Cancel failed: ${res.statusText}`);
      }

      await fetchStatus(taskId);
      setNote(""); // Clear note after cancel
      if (taskId) startPolling(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadgeColor(status: string): string {
    const colors: Record<string, string> = {
      queued: "bg-neutral-600",
      running: "bg-blue-600",
      awaiting_approval: "bg-amber-600",
      succeeded: "bg-emerald-600",
      failed: "bg-rose-600",
      rejected: "bg-rose-700",
      canceled: "bg-neutral-700"
    };
    return colors[status] || "bg-neutral-600";
  }

  return (
    <div ref={panelRef} className="p-4 rounded-2xl shadow-md border border-neutral-800 space-y-3 bg-neutral-900/50">
      <h3 className="text-lg font-semibold text-neutral-100">
        Agents — Approvals
      </h3>

      <AgentsStatusLegend />

      {/* Task ID Input */}
      <div className="flex gap-2">
        <input
          className="px-2 py-1 rounded bg-neutral-900 border border-neutral-700 w-[360px] text-neutral-100 placeholder-neutral-500 focus:border-neutral-600 focus:outline-none"
          placeholder="Task ID…"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && taskId && fetchStatus(taskId)}
          disabled={loading}
        />
        <button
          className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={() => taskId && fetchStatus(taskId)}
          disabled={loading || !taskId.trim()}
        >
          {loading ? "Loading..." : "Load"}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 rounded bg-rose-900/20 border border-rose-800 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Task Details */}
      {task && (
        <div className="space-y-3">
          {/* Status Header */}
          <div className="flex items-center gap-2 text-sm" role="status" aria-live="polite">
            <span className="text-neutral-400">
              [{task.agent}.{task.task}]
            </span>
            <span className="text-neutral-500">•</span>
            <span className="text-neutral-300">Status:</span>
            {statusBadge(task.status)}
            {task.updated_at && (
              <span className="text-xs text-neutral-500">updated {new Date(task.updated_at).toLocaleTimeString()}</span>
            )}
          </div>

          {/* Timestamps */}
          {(task.created_at || task.updated_at) && (
            <div className="text-xs text-neutral-500 space-y-0.5">
              {task.created_at && (
                <div>Created: {new Date(task.created_at).toLocaleString()}</div>
              )}
              {task.updated_at && (
                <div>Updated: {new Date(task.updated_at).toLocaleString()}</div>
              )}
            </div>
          )}

          {/* Outputs URI */}
          {task.outputs_uri && (
            <div className="text-xs text-neutral-400 flex items-center gap-2">
              <span>Artifact:</span>
              <code className="bg-neutral-950 px-1 py-0.5 rounded break-all flex-1">
                {task.outputs_uri}
              </code>
              <button
                className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors shrink-0"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(task.outputs_uri!);
                  } catch (err) {
                    console.warn("Copy failed:", err);
                  }
                }}
                title="Copy artifact path"
              >
                Copy
              </button>
            </div>
          )}

          {/* Approval Note Input */}
          <textarea
            className="w-full min-h-20 rounded bg-neutral-900 border border-neutral-700 p-2 text-neutral-100 placeholder-neutral-500 focus:border-neutral-600 focus:outline-none resize-y"
            placeholder="Approval note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={loading}
          />

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
              disabled={task.status !== "awaiting_approval" || loading}
              onClick={doApprove}
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              Approve
            </button>
            <button
              className="px-3 py-1 rounded bg-rose-700 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              disabled={
                !(["awaiting_approval", "queued", "running"].includes(task.status)) ||
                loading
              }
              onClick={doReject}
            >
              Reject
            </button>
            <button
              className="px-3 py-1 rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              disabled={!canAbort || loading}
              onClick={doCancel}
              title="Abort a queued/running task"
            >
              Abort
            </button>
          </div>

          {/* Logs Display */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-neutral-400">
              Logs (last 1000 chars):
            </div>
            <pre className="max-h-48 overflow-auto text-xs bg-neutral-950 border border-neutral-800 p-2 rounded text-neutral-300 font-mono">
              {task.logs_tail || "no logs"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
