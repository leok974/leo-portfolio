import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface FeedbackItem {
  ts: string;
  score: number;
  question?: string;
  answer?: string;
  served_by?: string;
  grounded?: boolean;
  sources_count?: number;
  note?: string;
}
interface FeedbackResp { ok: boolean; items: FeedbackItem[]; summary?: { count: number; up: number; down: number } }

export function AdminFeedbackWidget({ base = "" }: { base?: string }) {
  const [items, setItems] = React.useState<FeedbackItem[]>([]);
  const [sum, setSum] = React.useState<{ count: number; up: number; down: number } | null>(null);
  const [downOnly, setDownOnly] = React.useState(true);

  async function load() {
    try {
      const r: FeedbackResp = await (await fetch(`${base}/api/feedback/recent?limit=50`)).json();
      setItems(r.items || []);
      setSum(r.summary || null);
    } catch {}
  }
  React.useEffect(() => { load(); }, []);

  const rows = (downOnly ? items.filter(i => (i.score || 0) < 0) : items).slice().reverse().slice(0, 6);
  const pct = sum && sum.count > 0 ? Math.round(100 * (sum.up / sum.count)) : 0;

  return (
    <div className="pointer-events-auto flex w-[360px] flex-col gap-2 rounded-xl border border-slate-200/70 bg-white/90 p-3 shadow-lg backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">Admin</Badge>
        <span className="text-xs text-slate-600 dark:text-slate-300">Feedback</span>
        <div className="ml-auto flex items-center gap-2">
          <Badge className="bg-indigo-600 text-white">{pct}% 👍</Badge>
          <Button onClick={() => setDownOnly(v => !v)} className="h-8 px-3 text-xs bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
            {downOnly ? "Show all" : "Show 👎 only"}
          </Button>
          <Button onClick={load} className="h-8 px-3 text-xs">Refresh</Button>
        </div>
      </div>
      <div className="max-h-48 overflow-auto pr-1">
        <ul className="space-y-2 text-[11px]">
          {rows.map((r, i) => (
            <li key={(r.ts || i) as React.Key} className="rounded border border-slate-200/60 p-2 dark:border-slate-700/60">
              <div className="mb-1 flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span>{new Date(r.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                <span className={r.score > 0 ? 'text-emerald-600' : 'text-rose-600'}>{r.score > 0 ? '👍' : '👎'}</span>
                <span className="ml-auto text-[10px] opacity-70">{r.served_by || 'unknown'}</span>
              </div>
              {r.question && (
                <div className="text-slate-700 dark:text-slate-200">
                  <span className="font-medium">Q:</span> {r.question}
                </div>
              )}
              {r.answer && (
                <div className="text-slate-700 dark:text-slate-200">
                  <span className="font-medium">A:</span> {r.answer.slice(0, 160)}{r.answer.length > 160 ? '…' : ''}
                </div>
              )}
              {(r.note || r.sources_count || typeof r.grounded === 'boolean' || (r as any).route) && (
                <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                  {typeof r.grounded === 'boolean' && (<span>grounded: {String(r.grounded)} · </span>)}
                  {typeof r.sources_count === 'number' && (<span>sources: {r.sources_count} · </span>)}
                  {r.note && (<span>note: {r.note}</span>)}
                  {(r as any).route && (<span> · route: {(r as any).route}</span>)}
                </div>
              )}
            </li>
          ))}
          {rows.length === 0 && (
            <li className="text-slate-500 dark:text-slate-400">No feedback yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
