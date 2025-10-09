import React, { useEffect, useState } from "react";

interface Report {
  day: string;
  analysis: {
    median_ctr: number;
    anomalies: Array<{ page: string; reasons: string[] }>
  }
}

export default function SerpLatest() {
  const [r, setR] = useState<Report | null>(null);

  useEffect(() => {
    fetch('/agent/seo/serp/report')
      .then(x => x.ok ? x.json() : null)
      .then(setR)
      .catch(() => { /* Silently ignore fetch errors */ });
  }, []);

  if (!r) return <div className="text-sm opacity-70">No SERP report yet.</div>;

  return (
    <div className="rounded-xl border p-3">
      <div className="text-sm">
        Day: <b>{r.day}</b> · Median CTR: <b>{r.analysis.median_ctr.toFixed(3)}</b>
      </div>
      {r.analysis.anomalies.length === 0 ? (
        <div className="text-sm mt-2">No anomalies 🎉</div>
      ) : (
        <ul className="list-disc pl-5 mt-2">
          {r.analysis.anomalies.slice(0,5).map((a,i)=>(
            <li key={i} className="text-sm">
              <a className="underline" href={a.page} target="_blank" rel="noreferrer">{a.page}</a>
              <div className="opacity-70 text-xs">{a.reasons.join("; ")}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
