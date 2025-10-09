import React from "react";

export default function MetricsDebugPanel() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<any>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      try {
        const token = localStorage.getItem("dev:token");
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch {}
      const res = await fetch("/agent/metrics/debug", { headers });
      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        const body = ct.includes("application/json") ? await res.json() : await res.text();
        throw new Error(typeof body === "string" ? body : body?.detail || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Failed to load debug status");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    // lazy-load on mount
    void load();
  }, []);

  async function copyJson() {
    try {
      const text = JSON.stringify(data ?? {}, null, 2);
      await navigator.clipboard.writeText(text);
      setToast("Copied debug JSON");
    } catch {
      setToast("Copy failed");
    } finally {
      setTimeout(() => setToast(null), 2500);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-800/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/40 bg-neutral-950/30">
        <div className="text-sm font-medium">Debug Status</div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-neutral-700/60 hover:bg-neutral-800/40 text-sm disabled:opacity-50"
            title="Reload debug information"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            onClick={copyJson}
            disabled={!data}
            className="px-3 py-1.5 rounded-lg border border-neutral-700/60 hover:bg-neutral-800/40 text-sm disabled:opacity-50"
            title="Copy JSON to clipboard"
          >
            Copy JSON
          </button>
        </div>
      </div>
      <div className="p-3">
        {error ? (
          <div className="text-sm text-rose-400">{error}</div>
        ) : (
          <pre className="text-xs leading-relaxed overflow-auto whitespace-pre-wrap">
            {JSON.stringify(data ?? {}, null, 2)}
          </pre>
        )}
      </div>
      {toast && (
        <div
          className="pointer-events-none fixed right-4 bottom-4 px-3 py-1.5 rounded-lg shadow text-sm bg-neutral-800 text-neutral-50"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
