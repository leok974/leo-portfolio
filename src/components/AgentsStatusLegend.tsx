import { useState } from "react";

export default function AgentsStatusLegend() {
  const [expanded, setExpanded] = useState(false);

  const chip = (label: string, cls: string) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}>
      {label}
    </span>
  );

  return (
    <div
      className="flex flex-wrap gap-2 text-xs text-neutral-400 cursor-pointer"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <span className="mr-1">Legend:</span>
      {expanded ? (
        <>
          {chip("queued", "border-sky-700 bg-sky-900/30 text-sky-200")}
          {chip("running", "border-indigo-700 bg-indigo-900/30 text-indigo-200")}
          {chip("awaiting approval", "border-amber-700 bg-amber-900/30 text-amber-200")}
          {chip("succeeded", "border-emerald-700 bg-emerald-900/30 text-emerald-200")}
          {chip("failed", "border-rose-700 bg-rose-900/30 text-rose-200")}
          {chip("rejected", "border-rose-700 bg-rose-900/30 text-rose-200")}
          {chip("canceled", "border-zinc-700 bg-zinc-900/30 text-zinc-200")}
        </>
      ) : (
        <span className="text-neutral-500 italic">(hover to expand)</span>
      )}
    </div>
  );
}
