import React, { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

interface BeforeAfter {
  before?: {
    title?: string;
    description?: string;
    og?: string;
  };
  after?: {
    title?: string;
    description?: string;
    og?: string;
  };
}

/**
 * SeoTunePanel - Interface for SEO optimization with PR automation.
 *
 * Features:
 * - Dry run SEO tune generation
 * - Before/After preview cards (title, description, OG image)
 * - Approve → PR button for automated GitHub PR creation
 * - Diff and reasoning log display
 */
export function SeoTunePanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [diff, setDiff] = useState("");
  const [log, setLog] = useState("");
  const [beforeAfter, setBeforeAfter] = useState<BeforeAfter | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [persistMode, setPersistMode] = useState<'session' | 'local'>('session');
  const [badgePulse, setBadgePulse] = useState(false);

  // Restore PR URL from chosen storage on mount
  useEffect(() => {
    try {
      const storage = getPersistStorage();
      setPersistMode(storage === localStorage ? 'local' : 'session');
      const saved = storage.getItem('seo.pr.url');
      if (saved) setPrUrl(saved);
    } catch {}
  }, []);

  // Animate badge when persistMode changes
  useEffect(() => {
    setBadgePulse(true);
    const t = setTimeout(() => setBadgePulse(false), 600);
    return () => clearTimeout(t);
  }, [persistMode]);

  const runDryRun = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/agent/seo/tune?dry_run=true", {
        method: "POST",
      });
      const data = await response.json();
      if (data.ok) {
        setSuccess("Dry run complete! Review the diff and preview below.");
        await loadArtifacts();
      } else {
        setError(data.detail || "Dry run failed");
      }
    } catch (e: any) {
      setError(e.message || "Failed to run dry run");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadArtifacts = useCallback(async () => {
    setError("");
    try {
      const [diffResponse, logResponse] = await Promise.all([
        fetch("/agent/seo/artifacts/diff"),
        fetch("/agent/seo/artifacts/log"),
      ]);
      const diffText = await diffResponse.text();
      const logText = await logResponse.text();
      setDiff(diffText);
      setLog(logText);
      setBeforeAfter(parseBeforeAfterFromDiff(diffText));
    } catch (e: any) {
      setError(e.message || "Failed to load artifacts");
    }
  }, []);

  const openPR = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/agent/seo/act?action=seo.pr", {
        method: "POST",
      });
      const data = await response.json();
      if (data.ok) {
        // Extract PR URL from gh CLI output
        const match = String(data.pr || "").match(/https?:\/\/\S+/);
        if (match) {
          const url = match[0];
          // Persist PR URL in chosen storage
          try {
            const storage = getPersistStorage();
            storage.setItem('seo.pr.url', url);
          } catch {}
          setPrUrl(url);
          // Persist mode may change if query flag toggled; refresh label
          try {
            const storage = getPersistStorage();
            setPersistMode(storage === localStorage ? 'local' : 'session');
          } catch {}
          setSuccess(`PR created: ${url}`);
          toast.success("PR created", {
            action: {
              label: "Copy link",
              onClick: async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  toast.info("Copied!");
                } catch {}
              },
            },
          });
        } else {
          const message = data.pr
            ? `PR created: ${data.pr}`
            : `Branch pushed: ${data.branch}. ${data.detail || "Create PR manually."}`;
          setSuccess(message);
          toast.success("Branch pushed");
        }
      } else {
        setError(data.detail || "PR creation failed");
      }
    } catch (e: any) {
      setError(e.message || "Failed to create PR");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <section
      id="seo-tune"
      className="mx-auto my-6 max-w-4xl rounded-2xl border bg-white p-6 shadow-sm"
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">SEO & OG Intelligence</h2>
          <p className="text-sm text-gray-600">
            Generate optimized meta tags, OG images, and sitemaps
          </p>
        </div>
        <div className="flex gap-2">
          <button
            data-testid="seo-dry"
            onClick={runDryRun}
            disabled={loading}
            className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Running..." : "Dry Run"}
          </button>
          <button
            onClick={loadArtifacts}
            disabled={loading}
            className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            data-testid="seo-pr"
            onClick={openPR}
            disabled={loading || !diff}
            className="rounded-xl border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Approve → PR
          </button>
        </div>
      </header>

      {prUrl && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="opacity-70">Last PR:</span>
          <span
            data-testid="seo-pr-persist-badge"
            className={
              `px-2 py-0.5 rounded-full text-[11px] border uppercase tracking-wide opacity-80 ` +
              (badgePulse ? 'animate-pulse' : '')
            }
            title={persistMode === 'local' ? 'Stored in localStorage (persists across tabs)' : 'Stored in sessionStorage (this tab only)'}
          >{persistMode}</span>
          <a
            data-testid="seo-pr-link"
            className="underline hover:text-blue-600"
            href={prUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open
          </a>
          <button
            data-testid="seo-pr-copy"
            className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(prUrl);
                toast.info("PR link copied");
              } catch {}
            }}
          >
            Copy
          </button>
          <button
            data-testid="seo-pr-clear"
            className={`rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 ${!prUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!prUrl}
            onClick={() => {
              if (!prUrl) return;
              try {
                const storage = getPersistStorage();
                storage.removeItem('seo.pr.url');
              } catch {}
              setPrUrl(null);
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Status messages */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {success}
        </div>
      )}

      {/* Artifacts */}
      {(diff || log) && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Diff */}
          <div>
            <h3 className="mb-2 font-medium">Unified Diff</h3>
            <pre
              data-testid="seo-diff"
              className="h-64 overflow-auto rounded-lg border bg-gray-50 p-3 text-xs"
            >
              {diff || "No diff available"}
            </pre>
          </div>

          {/* Reasoning Log */}
          <div>
            <h3 className="mb-2 font-medium">Reasoning Log</h3>
            <div
              data-testid="seo-log"
              className="h-64 overflow-auto rounded-lg border bg-gray-50 p-3 text-xs"
            >
              <pre className="whitespace-pre-wrap">{log || "No log available"}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Before / After Preview */}
      {beforeAfter && (
        <div className="mt-6">
          <h3 className="mb-3 font-medium">Before / After (Meta & OG)</h3>
          <MetaCardPreview data={beforeAfter} />
        </div>
      )}
    </section>
  );
}

/**
 * Parse unified diff to extract before/after meta changes.
 */
function parseBeforeAfterFromDiff(diff: string): BeforeAfter {
  const lines = diff.split(/\r?\n/);
  const result: BeforeAfter = { before: {}, after: {} };

  for (const ln of lines) {
    const trimmed = ln.trim();

    // Extract title changes
    if (trimmed.startsWith("- title:")) {
      result.before!.title = trimmed.replace("- title:", "").trim();
    }
    if (trimmed.startsWith("+ title:")) {
      result.after!.title = trimmed.replace("+ title:", "").trim();
    }

    // Extract description changes
    if (trimmed.startsWith("- description:")) {
      result.before!.description = trimmed.replace("- description:", "").trim();
    }
    if (trimmed.startsWith("+ description:")) {
      result.after!.description = trimmed.replace("+ description:", "").trim();
    }

    // Extract OG image changes
    if (trimmed.startsWith("- og_image:")) {
      const ogPath = trimmed.replace("- og_image:", "").trim();
      if (ogPath && ogPath !== "None") {
        result.before!.og = ogPath;
      }
    }
    if (trimmed.startsWith("+ og_image:")) {
      const ogPath = trimmed.replace("+ og_image:", "").trim();
      if (ogPath && ogPath !== "None") {
        result.after!.og = ogPath;
      }
    }
  }

  return result;
}

/**
 * MetaCardPreview - Side-by-side before/after comparison cards.
 */
function MetaCardPreview({ data }: { data: BeforeAfter }) {
  const before = data.before || {};
  const after = data.after || {};

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Before Card */}
      <div className="rounded-xl border border-gray-300 bg-gray-50 p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Before
        </div>
        <div className="mb-2 truncate font-semibold">
          {before.title || "—"}
        </div>
        <div className="mb-3 line-clamp-3 text-sm text-gray-700">
          {before.description || "—"}
        </div>
        {before.og ? (
          <img
            alt="OG before"
            src={`/${before.og}`}
            className="rounded-lg border border-gray-300"
          />
        ) : (
          <div className="grid h-24 place-items-center rounded-lg border border-gray-300 bg-gray-100 text-sm text-gray-400">
            No OG Image
          </div>
        )}
      </div>

      {/* After Card */}
      <div className="rounded-xl border border-blue-300 bg-blue-50 p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-blue-600">
          After
        </div>
        <div className="mb-2 truncate font-semibold text-blue-900">
          {after.title || "—"}
        </div>
        <div className="mb-3 line-clamp-3 text-sm text-blue-800">
          {after.description || "—"}
        </div>
        {after.og ? (
          <img
            alt="OG after"
            src={`/${after.og}`}
            className="rounded-lg border border-blue-300"
          />
        ) : (
          <div className="grid h-24 place-items-center rounded-lg border border-blue-300 bg-blue-100 text-sm text-blue-400">
            No OG Image
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Get the storage mechanism based on feature flags.
 *
 * Supports two modes:
 * 1. Query param: ?seoPersist=local → use localStorage
 * 2. Global flag: window.__SEO_PR_PERSIST__ = 'local' → use localStorage
 * 3. Default: sessionStorage
 *
 * @returns Storage object (localStorage or sessionStorage)
 */
function getPersistStorage(): Storage {
  try {
    const qs = new URLSearchParams(location.search);
    const mode = (window as any).__SEO_PR_PERSIST__ || qs.get('seoPersist');
    return mode === 'local' ? localStorage : sessionStorage;
  } catch {
    return sessionStorage;
  }
}
