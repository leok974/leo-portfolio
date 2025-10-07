import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface Weights {
  freshness: number;
  signal: number;
  fit: number;
  media: number;
}

export function WeightsEditor({ base = "" }: { base?: string }) {
  const [active, setActive] = useState<Weights | null>(null);
  const [draft, setDraft] = useState<Weights | null>(null);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${base}/agent/layout/weights`);
        if (!res.ok) return;
        const json = await res.json();
        setActive(json.active);
        setDraft(json.proposed || json.active);
      } catch (e) {
        console.error("Failed to load weights:", e);
      }
    })();
  }, [base]);

  const total = useMemo(
    () => (draft ? draft.freshness + draft.signal + draft.fit + draft.media : 1),
    [draft]
  );
  
  const norm = useMemo(() => {
    if (!draft || total === 0) return null;
    return {
      freshness: draft.freshness / total,
      signal: draft.signal / total,
      fit: draft.fit / total,
      media: draft.media / total,
    } as Weights;
  }, [draft, total]);

  function update(k: keyof Weights, v: number) {
    if (!draft) return;
    setDraft({ ...draft, [k]: v });
  }

  async function saveProposal() {
    if (!draft) return;
    try {
      const res = await fetch(`${base}/agent/layout/weights/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setMsg(res.ok ? "Proposal saved" : "Failed to save proposal");
    } catch (e) {
      setMsg("Network error");
    }
  }

  async function approve() {
    try {
      const res = await fetch(`${base}/agent/layout/weights/approve`, { method: "POST" });
      if (res.ok) {
        setMsg("Activated");
        const refreshed = await (await fetch(`${base}/agent/layout/weights`)).json();
        setActive(refreshed.active);
      } else {
        setMsg("Approve failed");
      }
    } catch (e) {
      setMsg("Network error");
    }
  }

  async function optimizeWithDraft() {
    try {
      const res = await fetch(`${base}/agent/act`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "layout.optimize", payload: { weights: draft } }),
      });
      setMsg(res.ok ? "Optimized with proposed weights" : "Optimize failed");
    } catch (e) {
      setMsg("Network error");
    }
  }

  if (!draft || !norm) return null;

  const Row = ({ k, label }: { k: keyof Weights; label: string }) => (
    <label className="block my-2">
      <div className="flex justify-between text-sm">
        <span className="capitalize">{label}</span>
        <span className="font-mono">{Math.round(norm![k] * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={draft[k]}
        onChange={(e) => update(k, parseFloat(e.currentTarget.value))}
        className="w-full accent-blue-600"
      />
    </label>
  );

  return (
    <div data-testid="weights-editor" className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-2 bg-white dark:bg-gray-800">
      <div className="text-base font-semibold">Weight Editor</div>
      <Row k="freshness" label="freshness" />
      <Row k="signal" label="signal" />
      <Row k="fit" label="fit" />
      <Row k="media" label="media" />
      <div className="text-xs opacity-70">
        Total normalizes to 100% automatically when saving/optimizing.
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          data-testid="save-proposal"
          className="px-3 py-1 h-auto text-xs"
          onClick={saveProposal}
        >
          Save proposal
        </Button>
        <Button
          data-testid="approve-weights"
          className="px-3 py-1 h-auto text-xs"
          onClick={approve}
        >
          Approve
        </Button>
        <Button
          data-testid="optimize-with-proposal"
          className="px-3 py-1 h-auto text-xs"
          onClick={optimizeWithDraft}
        >
          Optimize w/ proposal
        </Button>
      </div>
      <div data-testid="weights-msg" className="text-xs opacity-70">
        {msg}
      </div>
      {active && (
        <div className="text-xs opacity-70 font-mono">
          Active: f={active.freshness.toFixed(2)} s={active.signal.toFixed(2)} fit={active.fit.toFixed(2)} m={active.media.toFixed(2)}
        </div>
      )}
    </div>
  );
}
