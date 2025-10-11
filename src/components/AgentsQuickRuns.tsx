import { useEffect, useState } from "react";

interface RunResp {
  task_id: string;
  status: string;
  needs_approval: boolean;
  outputs_uri?: string;
}

interface ToastItem {
  id: number;
  message: string;
}

function ToastQueue({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast, idx) => (
        <ToastMessage key={toast.id} message={toast.message} index={idx} onClose={() => onRemove(toast.id)} />
      ))}
    </div>
  );
}

function ToastMessage({ message, index, onClose }: { message: string; index: number; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="rounded-xl border border-neutral-700 bg-neutral-900/95 shadow-xl px-4 py-2 text-sm animate-in slide-in-from-right"
      role="status"
      aria-live="polite"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {message}
    </div>
  );
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function PresetButton({
  label,
  payload,
  onDone,
}: {
  label: string;
  payload: { agent: string; task: string; inputs?: Record<string, unknown> };
  onDone: (r: RunResp) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RunResp = await res.json();
      onDone(data);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 transition-colors text-sm"
      disabled={busy}
      onClick={run}
      title={`${payload.agent}.${payload.task}`}
    >
      {busy ? "Running…" : label}
    </button>
  );
}

export default function AgentsQuickRuns({
  onLaunched,
}: {
  onLaunched: (r: RunResp) => void;
}) {
  const [last, setLast] = useState<RunResp | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [nextToastId, setNextToastId] = useState(0);

  function showToast(message: string) {
    const id = nextToastId;
    setNextToastId(id + 1);
    setToasts((prev) => [...prev, { id, message }]);
  }

  function removeToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleLaunched(r: RunResp) {
    setLast(r);
    onLaunched?.(r);
    const ok = await copy(r.task_id);
    showToast(ok ? `task_id copied: ${r.task_id}` : `task_id: ${r.task_id}`);
    // also copy a deep link for /admin?task_id=<id>
    const url = `${location.origin}/admin?task_id=${encodeURIComponent(r.task_id)}`;
    try { await navigator.clipboard.writeText(url); } catch {}
    // Notify listeners (e.g., Approval Panel) to auto-load this task
    window.dispatchEvent(new CustomEvent("agents:launched", { detail: r }));
  }

  function statusBadgeSmall(status?: string) {
    const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border";
    switch ((status || "").toLowerCase()) {
      case "queued": return <span className={`${base} border-sky-700 bg-sky-900/30 text-sky-200`}>queued</span>;
      case "running": return <span className={`${base} border-indigo-700 bg-indigo-900/30 text-indigo-200`}>running</span>;
      case "awaiting_approval": return <span className={`${base} border-amber-700 bg-amber-900/30 text-amber-200`}>awaiting</span>;
      case "succeeded": return <span className={`${base} border-emerald-700 bg-emerald-900/30 text-emerald-200`}>succeeded</span>;
      case "failed": return <span className={`${base} border-rose-700 bg-rose-900/30 text-rose-200`}>failed</span>;
      case "rejected": return <span className={`${base} border-rose-700 bg-rose-900/30 text-rose-200`}>rejected</span>;
      case "canceled": return <span className={`${base} border-zinc-700 bg-zinc-900/30 text-zinc-200`}>canceled</span>;
      default: return <span className={`${base} border-neutral-700 bg-neutral-900/30 text-neutral-300`}>{status || "unknown"}</span>;
    }
  }

  return (
    <div className="p-4 rounded-2xl shadow-md border border-neutral-800 space-y-2 bg-neutral-900/50">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-100">Agents — Quick runs</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        <PresetButton
          label="SEO • validate (site)"
          payload={{ agent: "seo", task: "validate", inputs: { pages: "sitemap://current" } }}
          onDone={handleLaunched}
        />
        <PresetButton
          label="SEO • tune (autofix draft)"
          payload={{ agent: "seo", task: "tune", inputs: { pages: "sitemap://current" } }}
          onDone={handleLaunched}
        />
        <PresetButton
          label="Code • review (diff HEAD)"
          payload={{ agent: "code", task: "review" }}
          onDone={handleLaunched}
        />
        <PresetButton
          label="DX • integrate (checks)"
          payload={{ agent: "dx", task: "integrate" }}
          onDone={handleLaunched}
        />
        <PresetButton
          label="Infra • scale (plan)"
          payload={{ agent: "infra", task: "scale" }}
          onDone={handleLaunched}
        />
        <PresetButton
          label="Projects • sync"
          payload={{
            agent: "projects",
            task: "sync",
            inputs: { repos: ["leok974/leo-portfolio", "leok974/ledger-mind"] },
          }}
          onDone={handleLaunched}
        />
        <PresetButton
          label="Content • summarize CHANGELOG"
          payload={{
            agent: "content",
            task: "summarize",
            inputs: { source: "docs/CHANGELOG.md" },
          }}
          onDone={handleLaunched}
        />
        <PresetButton
          label="Branding • propose theme"
          payload={{ agent: "branding", task: "theme", inputs: { base: "current" } }}
          onDone={handleLaunched}
        />
      </div>
      <p className="text-xs text-neutral-400">
        All mutating tasks remain <b>awaiting approval</b> until you confirm in the panel below.
      </p>
      {last && (
        <div className="mt-2 text-xs border border-neutral-800 rounded-lg p-2 bg-neutral-950">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate flex items-center gap-2">
              <span>Last task:</span>
              {statusBadgeSmall(last.status)}
              <span>—</span>
              <code className="break-all">{last.task_id}</code>
            </div>
            <button
              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700"
              onClick={async () => {
                const ok = await copy(last.task_id);
                showToast(ok ? "task_id copied" : "Clipboard blocked — copied to screen");
              }}
            >
              Copy task_id
            </button>
            <button
              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700"
              onClick={async () => {
                const url = `${location.origin}/admin?task_id=${encodeURIComponent(last.task_id)}`;
                const ok = await copy(url);
                showToast(ok ? "Deep link copied" : "Deep link on screen");
              }}
            >
              Copy deep link
            </button>
          </div>
          {last.outputs_uri && (
            <div className="mt-1 truncate text-neutral-400">
              Artifact: <code className="break-all">{last.outputs_uri}</code>
            </div>
          )}
        </div>
      )}
      <ToastQueue toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
