import React, { useMemo, useState } from "react";

interface ValidateResult {
  count: number;
  errors: string[];
  warnings: string[];
}

function defaultTypesForPath(pathname: string) {
  const isProject = /\/projects\//.test(pathname);
  return isProject
    ? ["WebPage","WebSite","BreadcrumbList","Person","Organization","CreativeWork"]
    : ["WebPage","WebSite","BreadcrumbList","Person","Organization","Article"];
}

async function getDomJsonLd(): Promise<any[]> {
  const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const out: any[] = [];
  for (const el of nodes) {
    const txt = el.textContent || "";
    try {
      const parsed = JSON.parse(txt);
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed["@graph"]) out.push(...parsed["@graph"]);
      else out.push(parsed);
    } catch { /* ignore malformed */ }
  }
  return out;
}

async function postJSON<T=any>(url: string, data: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export default function SeoJsonLdPanel() {
  const [blob, setBlob] = useState<string>("[]");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [msg, setMsg] = useState<string>("");

  const endpointBase = useMemo(() => (window as any).SEO_LD_ENDPOINT || "/agent/seo/ld", []);
  const typesDefault = useMemo(() => defaultTypesForPath(location.pathname), []);

  async function loadFromDOM() {
    setBusy(true); setMsg(""); setResult(null);
    try {
      const arr = await getDomJsonLd();
      setBlob(JSON.stringify(arr, null, 2));
      setMsg(`Loaded ${arr.length} object(s) from DOM.`);
    } catch (e:any) {
      setMsg(`Failed: ${e?.message || e}`);
    } finally { setBusy(false); }
  }

  async function generateFromBackend() {
    setBusy(true); setMsg(""); setResult(null);
    try {
      const url = location.href;
      const payload = { url, types: typesDefault, dry_run: true };
      const data = await postJSON<{ jsonld: any[]; report: ValidateResult }>(`${endpointBase}/generate`, payload);
      setBlob(JSON.stringify(data.jsonld, null, 2));
      setResult(data.report);
      setMsg(`Generated ${data.jsonld.length} object(s) [errors: ${data.report.errors.length}, warnings: ${data.report.warnings.length}]`);
    } catch (e:any) {
      setMsg(`Failed: ${e?.message || e}`);
    } finally { setBusy(false); }
  }

  async function validateBlob() {
    setBusy(true); setMsg("");
    try {
      const parsed = JSON.parse(blob || "[]");
      const rep = await postJSON<ValidateResult>(`${endpointBase}/validate`, { jsonld: parsed });
      setResult(rep);
      setMsg(`Validated: ${rep.count} object(s).`);
    } catch (e:any) {
      setMsg(`Failed: ${e?.message || e}`);
    } finally { setBusy(false); }
  }

  async function copyBlob() {
    await navigator.clipboard.writeText(blob);
    setMsg("Copied JSON-LD to clipboard.");
  }

  return (
    <div data-testid="seo-ld-panel" className="rounded-xl border p-4 bg-white/70 dark:bg-zinc-900/60 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-lg font-semibold">SEO — JSON-LD Preview</h3>
        <div className="text-xs opacity-70">types: {typesDefault.join(", ")}</div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button data-testid="seo-ld-load-dom" disabled={busy} className="px-3 py-1.5 rounded-md border"
          onClick={loadFromDOM}>Load from DOM</button>
        <button data-testid="seo-ld-generate" disabled={busy} className="px-3 py-1.5 rounded-md border"
          onClick={generateFromBackend}>Generate (backend)</button>
        <button data-testid="seo-ld-validate" disabled={busy} className="px-3 py-1.5 rounded-md border"
          onClick={validateBlob}>Validate</button>
        <button data-testid="seo-ld-copy" disabled={busy} className="px-3 py-1.5 rounded-md border"
          onClick={copyBlob}>Copy</button>
      </div>

      <textarea
        data-testid="seo-ld-textarea"
        className="w-full h-56 font-mono text-sm rounded-md border p-2"
        value={blob}
        onChange={(e)=>setBlob(e.target.value)}
        spellCheck={false}
      />

      <div className="mt-3 grid gap-2">
        {result && (
          <div className="text-sm" data-testid="seo-ld-result">
            <div><strong>Count:</strong> {result.count}</div>
            <div><strong>Errors:</strong> {result.errors.length}</div>
            <div><strong>Warnings:</strong> {result.warnings.length}</div>
            {result.errors.length > 0 && (
              <details className="mt-1"><summary>Show errors</summary>
                <ul className="list-disc pl-5">{result.errors.map((e,i)=><li key={i}>{e}</li>)}</ul>
              </details>
            )}
            {result.warnings.length > 0 && (
              <details className="mt-1"><summary>Show warnings</summary>
                <ul className="list-disc pl-5">{result.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>
              </details>
            )}
          </div>
        )}
        {msg && <div className="text-xs opacity-70" data-testid="seo-ld-msg">{msg}</div>}
      </div>
    </div>
  );
}
