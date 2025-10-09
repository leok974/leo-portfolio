import React from "react";
import { fetchSnapshot, getVisitorId, sendEvent } from "../lib/metrics";

interface Snap {
  total: number;
  by_event: { event: string; count: number }[];
  last_events: { visitor_id: string; event: string; timestamp: string; metadata?: any }[];
  file_size_bytes?: number | null;
}

export default function BehaviorMetricsDebugPanel() {
  const [snap, setSnap] = React.useState<Snap | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function refresh() {
    setLoading(true); setErr(null);
    try { setSnap(await fetchSnapshot(50)); }
    catch (e: any) { setErr(e?.message ?? String(e)); }
    finally { setLoading(false); }
  }

  async function demoBurst() {
    const vid = getVisitorId();
    await sendEvent({ visitor_id: vid, event: "page_view", metadata: { path: location.pathname } });
    await sendEvent({ visitor_id: vid, event: "link_click", metadata: { href: "https://example.com" } });
    await refresh();
  }

  React.useEffect(() => { void refresh(); }, []);

  return (
    <div className="p-4 rounded-2xl border shadow-sm space-y-3 bg-white/5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Behavior Metrics Snapshot</h3>
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded-lg border" onClick={demoBurst}>Send demo events</button>
          <button className="px-3 py-1 rounded-lg border" onClick={refresh} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
        </div>
      </div>
      {err && <div className="text-red-500 text-sm">{err}</div>}
      {snap && (
        <div className="space-y-3">
          <div className="text-sm opacity-80">total: {snap.total} · file: {snap.file_size_bytes ?? 0} B · visitor: {getVisitorId()}</div>
          <div>
            <h4 className="font-medium mb-1">by_event</h4>
            <ul className="text-sm grid grid-cols-2 gap-1">
              {snap.by_event.map((b) => (
                <li key={b.event} className="px-2 py-1 rounded border flex items-center justify-between">
                  <span>{b.event}</span><span className="tabular-nums">{b.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-1">last_events</h4>
            <div className="max-h-64 overflow-auto text-xs">
              <table className="w-full">
                <thead>
                  <tr className="text-left">
                    <th className="pr-2">time</th>
                    <th className="pr-2">event</th>
                    <th className="pr-2">visitor</th>
                    <th>metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.last_events.map((e, i) => (
                    <tr key={i} className="border-t border-white/10">
                      <td className="pr-2 whitespace-nowrap">{new Date(e.timestamp).toLocaleTimeString()}</td>
                      <td className="pr-2">{e.event}</td>
                      <td className="pr-2 truncate max-w-[10ch]">{e.visitor_id}</td>
                      <td className="font-mono text-[11px] opacity-80">{JSON.stringify(e.metadata ?? {})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
