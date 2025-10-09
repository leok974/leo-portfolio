/**
 * Dev Pages Panel
 *
 * Displays discovered pages from sitemap/filesystem with title/desc metadata.
 * Provides filtering and JSON export capabilities.
 */
import React from "react";
import { approveAndOpenPR } from "@/api";

// Helper to copy text to clipboard
const copy = (s: string) => navigator.clipboard.writeText(s);
const openInNewTab = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

interface PageRow {
  path: string;
  title?: string | null;
  desc?: string | null;
}

interface Payload {
  ok: boolean;
  generated_at: string;
  count: number;
  integrity: {
    algo: string;
    value: string;
    size: number;
  };
  pages: PageRow[];
}

export default function DevPagesPanel() {
  const [data, setData] = React.useState<Payload | null>(null);
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Meta suggestion modal state
  const [metaFor, setMetaFor] = React.useState<string | null>(null);
  const [metaData, setMetaData] = React.useState<any | null>(null);
  const [metaErr, setMetaErr] = React.useState<string | null>(null);

  // Editable fields for preview/commit
  const [titleInput, setTitleInput] = React.useState("");
  const [descInput, setDescInput] = React.useState("");

  // Preview/commit state
  const [preview, setPreview] = React.useState<any | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [commitMsg, setCommitMsg] = React.useState<string | null>(null);

  const closeMeta = () => {
    setMetaFor(null);
    setMetaData(null);
    setMetaErr(null);
    setPreview(null);
    setCommitMsg(null);
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/agent/status/pages", {
        headers: { "Accept": "application/json" }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Payload;
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const rows = React.useMemo(() => {
    if (!data?.pages) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return data.pages;
    return data.pages.filter(p =>
      (p.path ?? "").toLowerCase().includes(needle) ||
      (p.title ?? "").toLowerCase().includes(needle) ||
      (p.desc ?? "").toLowerCase().includes(needle)
    );
  }, [data, q]);

  const copyJson = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(JSON.stringify(data.pages, null, 2));
  };

  const fetchSuggest = async (path: string) => {
    setMetaFor(path);
    setMetaErr(null);
    setMetaData(null);
    setPreview(null);
    setCommitMsg(null);
    try {
      const res = await fetch(`/agent/seo/meta/suggest?path=${encodeURIComponent(path)}`, {
        headers: { "Accept": "application/json" }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMetaData(await res.json());
    } catch (e: any) {
      setMetaErr(e?.message || "Failed to suggest");
    }
  };

  // Populate editable fields when suggestion loads
  React.useEffect(() => {
    if (metaData?.suggestion) {
      setTitleInput(metaData.suggestion.title || "");
      setDescInput(metaData.suggestion.desc || "");
    }
  }, [metaData]);

  const doPreview = async () => {
    if (!metaFor) return;
    setBusy(true);
    setCommitMsg(null);
    try {
      const res = await fetch(`/agent/seo/meta/preview?path=${encodeURIComponent(metaFor)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ title: titleInput, desc: descInput })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPreview(await res.json());
    } catch (e: any) {
      setCommitMsg(e?.message || "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const doCommit = async () => {
    if (!metaFor) return;
    setBusy(true);
    setCommitMsg(null);
    try {
      const res = await fetch(`/agent/seo/meta/commit?path=${encodeURIComponent(metaFor)}&confirm=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ title: titleInput, desc: descInput })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setCommitMsg(j?.applied ? "Changes applied ✔" : "No changes applied");
    } catch (e: any) {
      setCommitMsg(e?.message || "Commit failed");
    } finally {
      setBusy(false);
    }
  };

  const doAutoPR = async () => {
    setBusy(true);
    setCommitMsg(null);
    try {
      const result = await approveAndOpenPR({
        labels: ['auto', 'seo'],
        use_llm: true,
        attach_insights: true
      });
      
      if (result.pr) {
        setCommitMsg(`✅ PR created: ${result.pr}`);
        openInNewTab(result.pr);
      } else if (result.branch) {
        setCommitMsg(`✅ Branch created: ${result.branch}`);
      } else {
        setCommitMsg(`Status: ${result.status}`);
      }
    } catch (e: any) {
      setCommitMsg(`❌ ${e?.message || "PR creation failed"}`);
    } finally {
      setBusy(false);
    }
  };

  const openPRHelper = () => {
    // Open GitHub Actions workflow dispatch page for siteagent-meta-pr
    const repo = import.meta.env?.VITE_GITHUB_REPO || "leok974/leo-portfolio";
    openInNewTab(`https://github.com/${repo}/actions/workflows/siteagent-meta-pr.yml`);
  };

  const revealInSitemap = async (path: string) => {
    try {
      const res = await fetch("/agent/status/sitemap", {
        headers: { "Accept": "application/json" }
      });
      if (!res.ok) {
        openInNewTab("/agent/status/sitemap?raw=1");
        return;
      }
      const j = await res.json();
      const present = Array.isArray(j?.urls) && j.urls.includes(path);
      if (present) {
        // Open raw so user can see it; no anchors in xml, but this confirms presence
        openInNewTab("/agent/status/sitemap?raw=1");
      } else {
        alert(`${path} is NOT in sitemap.xml`);
      }
    } catch (_e) {
      openInNewTab("/agent/status/sitemap?raw=1");
    }
  };

  return (
    <div data-testid="dev-pages-panel" className="p-4 space-y-4">
      <div className="flex items-center gap-2 justify-between">
        <div className="text-lg font-semibold">Discovered Pages</div>
        <div className="text-xs opacity-70">
          {data?.generated_at ? new Date(data.generated_at).toLocaleString() : "—"}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          className="w-full px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-sm outline-none focus:ring"
          placeholder="Filter by path, title, or description…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          onClick={load}
          className="px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-950 hover:bg-zinc-900 text-sm"
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        <button
          onClick={copyJson}
          className="px-3 py-2 rounded-xl border border-emerald-700 bg-emerald-900/30 hover:bg-emerald-900/50 text-sm"
          disabled={!data}
        >
          Copy JSON
        </button>
      </div>

      {err && <div className="text-red-400 text-sm">{err}</div>}

      <div className="rounded-2xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/60">
            <tr>
              <th className="text-left px-3 py-2">Path</th>
              <th className="text-left px-3 py-2">Title</th>
              <th className="text-left px-3 py-2">Description</th>
              <th className="text-left px-3 py-2 w-36">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const rawHref = `/agent/status/open?path=${encodeURIComponent(p.path)}&raw=1`;
              const metaHref = `/agent/status/open?path=${encodeURIComponent(p.path)}`;
              return (
                <tr
                  key={`${p.path}-${i}`}
                  className="border-t border-zinc-800 hover:bg-zinc-900/40"
                >
                  <td className="px-3 py-2 font-medium">{p.path}</td>
                  <td className="px-3 py-2">
                    {p.title || <span className="opacity-60">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="opacity-90">
                      {p.desc || <span className="opacity-60">—</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2 flex-wrap">
                      <a
                        href={rawHref}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 rounded-lg border border-zinc-700 bg-zinc-950 hover:bg-zinc-900 text-xs"
                        title="Open raw (new tab)"
                      >
                        Open
                      </a>
                      <button
                        onClick={async () => {
                          // fetch metadata to get absolute path for copy
                          try {
                            const res = await fetch(metaHref, { headers: { "Accept": "application/json" }});
                            const json = await res.json();
                            await copy(json?.abs_path ?? p.path);
                          } catch {
                            await copy(p.path);
                          }
                        }}
                        className="px-2 py-1 rounded-lg border border-zinc-700 bg-zinc-950 hover:bg-zinc-900 text-xs"
                        title="Copy absolute path"
                      >
                        Copy path
                      </button>
                      <button
                        onClick={() => revealInSitemap(p.path)}
                        className="px-2 py-1 rounded-lg border border-indigo-700 bg-indigo-900/30 hover:bg-indigo-900/50 text-xs"
                        title="Reveal in sitemap.xml"
                      >
                        Reveal
                      </button>
                      <button
                        onClick={() => fetchSuggest(p.path)}
                        className="px-2 py-1 rounded-lg border border-amber-700 bg-amber-900/30 hover:bg-amber-900/50 text-xs"
                        title="Suggest title/description"
                      >
                        Suggest meta
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center opacity-70">
                  {loading ? "Loading…" : "No pages matched your filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data?.integrity && (
        <div className="text-xs opacity-70">
          integrity: <code>{data.integrity.algo}:{data.integrity.value}</code>{" "}
          ({data.integrity.size} bytes) • total {data.count}
        </div>
      )}

      {/* Meta Suggestion Modal */}
      {metaFor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">
                Meta suggestions for <span className="opacity-80">{metaFor}</span>
              </div>
              <button
                onClick={closeMeta}
                className="px-2 py-1 text-sm opacity-70 hover:opacity-100"
              >
                Close
              </button>
            </div>

            {metaErr && <div className="text-red-400 text-sm">{metaErr}</div>}
            {!metaErr && !metaData && <div className="text-sm opacity-80">Generating…</div>}

            {metaData && (
              <div className="space-y-3">
                <div className="text-xs opacity-70">
                  Keywords: {metaData.keywords?.join(", ") || "—"}
                </div>

                <div>
                  <div className="text-xs opacity-70 mb-1">
                    Title (≤ {metaData.suggestion?.limits?.title_max || 60}) — {titleInput.length} chars
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="w-full px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-sm"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                    />
                    <button
                      onClick={() => copy(titleInput)}
                      className="px-3 py-2 rounded-xl border border-zinc-700 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs opacity-70 mb-1">
                    Description (≤ {metaData.suggestion?.limits?.desc_max || 155}) — {descInput.length} chars
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      className="w-full h-28 px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-sm resize-none"
                      value={descInput}
                      onChange={(e) => setDescInput(e.target.value)}
                    />
                    <button
                      onClick={() => copy(descInput)}
                      className="px-3 py-2 rounded-xl border border-zinc-700 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* Preview & Commit Buttons */}
                <div className="flex gap-2 items-center flex-wrap">
                  <button
                    onClick={doPreview}
                    disabled={busy}
                    className="px-3 py-2 rounded-xl border border-sky-700 bg-sky-900/30 hover:bg-sky-900/50 text-sm disabled:opacity-50"
                  >
                    {busy ? "Working…" : "Preview diff"}
                  </button>
                  <button
                    onClick={doCommit}
                    disabled={busy}
                    className="px-3 py-2 rounded-xl border border-emerald-700 bg-emerald-900/30 hover:bg-emerald-900/50 text-sm disabled:opacity-50"
                  >
                    {busy ? "Working…" : "Approve & commit"}
                  </button>
                  <button
                    onClick={doAutoPR}
                    disabled={busy}
                    className="px-3 py-2 rounded-xl border border-purple-700 bg-purple-900/30 hover:bg-purple-900/50 text-sm disabled:opacity-50"
                    title="Create PR with AI-generated title/body and analytics insights"
                  >
                    {busy ? "Working…" : "Auto PR (LLM)"}
                  </button>
                  <button
                    onClick={openPRHelper}
                    className="px-3 py-2 rounded-xl border border-fuchsia-700 bg-fuchsia-900/30 hover:bg-fuchsia-900/50 text-sm"
                    title="Open the GitHub Actions PR helper workflow"
                  >
                    Open PR helper
                  </button>
                  {commitMsg && <div className="text-xs opacity-80">{commitMsg}</div>}
                </div>

                {/* Diff Preview */}
                {preview && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 mt-3">
                    <div className="text-xs px-3 py-2 border-b border-zinc-800 opacity-70">
                      Diff — {preview.empty_diff ? "no changes" : "proposed changes"} · integrity: {preview.integrity?.algo}:{preview.integrity?.value?.substring(0, 12)}...
                    </div>
                    <div className="p-3">
                      <div className="text-xs opacity-70">
                        {preview.empty_diff && "(no-op)"}
                        {!preview.empty_diff && preview.artifacts?.diff && (
                          <div>
                            Changed: {preview.changed?.title && "title"} {preview.changed?.description && "description"}
                            <br />
                            Artifact: <code>{preview.artifacts.diff}</code>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-xs opacity-70">
                  integrity: <code>{metaData.integrity?.algo}:{metaData.integrity?.value}</code>{" "}
                  ({metaData.integrity?.size} bytes)
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
