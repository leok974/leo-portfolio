/* eslint-disable */
/**
 * SEO JSON-LD Admin Fallback Panel
 *
 * Lightweight zero-dependency JSON-LD preview/validate UI.
 * Enabled via query param ?seoLd=1 or localStorage.seoLdPanel="1"
 *
 * Features:
 * - Load JSON-LD from DOM (parses static scripts)
 * - Generate JSON-LD via backend API
 * - Validate JSON-LD structure
 * - Copy to clipboard
 *
 * Usage:
 * 1. Add to HTML: <script src="/assets/js/ld-admin.js" defer></script>
 * 2. Enable: Visit any page with ?seoLd=1 or run localStorage.seoLdPanel="1"
 * 3. Click floating "JSON-LD" button to open panel
 */
(() => {
  const enabled = new URLSearchParams(location.search).get("seoLd") === "1" || localStorage.getItem("seoLdPanel") === "1";
  if (!enabled) return;

  const css = `
  .seoLdBtn{position:fixed;right:12px;bottom:12px;padding:8px 10px;border:1px solid #ccc;border-radius:10px;background:#fff;z-index:99999;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
  .seoLdBtn:hover{background:#f5f5f5}
  .seoLdBox{position:fixed;right:12px;bottom:56px;width:520px;max-width:95vw;height:420px;background:#fff;border:1px solid #ddd;border-radius:12px;padding:10px;z-index:99999;display:none;box-shadow:0 4px 16px rgba(0,0,0,0.15)}
  .seoLdBox.show{display:block}
  .seoLdBox textarea{width:100%;height:240px;font-family:ui-monospace,Consolas,monospace;font-size:12px;border:1px solid #ddd;border-radius:4px;padding:8px}
  .seoLdRow{display:flex;gap:8px;margin-bottom:8px}
  .seoLdRow button{padding:6px 12px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;font-size:13px}
  .seoLdRow button:hover{background:#f0f0f0}
  .seoLdRow button:disabled{opacity:0.5;cursor:not-allowed}
  @media (prefers-color-scheme: dark) {
    .seoLdBtn,.seoLdBox{background:#1a1a1a;border-color:#333;color:#fff}
    .seoLdBox textarea{background:#2a2a2a;border-color:#444;color:#fff}
    .seoLdRow button{background:#2a2a2a;border-color:#444;color:#fff}
    .seoLdRow button:hover{background:#333}
  }
  `;
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);

  const btn = document.createElement("button"); btn.className = "seoLdBtn"; btn.textContent = "JSON-LD";
  const box = document.createElement("div"); box.className = "seoLdBox"; box.innerHTML = `
    <div class="seoLdRow">
      <button data-a="dom">Load from DOM</button>
      <button data-a="gen">Generate (backend)</button>
      <button data-a="val">Validate</button>
      <button data-a="copy">Copy</button>
      <button data-a="close" style="margin-left:auto">Close</button>
    </div>
    <textarea spellcheck="false" data-a="ta">[]</textarea>
    <div class="seoLdRow"><small data-a="msg"></small></div>
    <div class="seoLdRow"><small data-a="res"></small></div>
  `;

  // @ts-ignore - Parameters have runtime types
  async function postJSON(url, data){ const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}); if(!r.ok) throw new Error(r.statusText); return r.json(); }
  async function getDom(){
    const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    const out=[]; for(const el of nodes){ const t=el.textContent||""; try{ const p=JSON.parse(t); if(Array.isArray(p)) out.push(...p); else if(p['@graph']) out.push(...p['@graph']); else out.push(p);}catch{} }
    return out;
  }
  function types(){ return /\/projects\//.test(location.pathname)
    ? ["WebPage","WebSite","BreadcrumbList","Person","Organization","CreativeWork"]
    : ["WebPage","WebSite","BreadcrumbList","Person","Organization","Article"]; }

  btn.addEventListener("click", ()=> box.classList.toggle("show"));
  // @ts-ignore - Element exists in DOM
  box.querySelector('[data-a="close"]').addEventListener("click", ()=> box.classList.remove("show"));

  // @ts-ignore - Element exists in DOM
  box.querySelector('[data-a="dom"]').addEventListener("click", async ()=>{
    // @ts-ignore - Element exists in DOM
    const ta = box.querySelector('[data-a="ta"]'); const msg = box.querySelector('[data-a="msg"]'); const arr = await getDom();
    // @ts-ignore - HTMLTextAreaElement has value property
    ta.value = JSON.stringify(arr, null, 2); msg.textContent = `Loaded ${arr.length} object(s) from DOM.`;
  });

  // @ts-ignore - Element exists in DOM
  box.querySelector('[data-a="gen"]').addEventListener("click", async ()=>{
    // @ts-ignore - Element exists in DOM
    const ta = box.querySelector('[data-a="ta"]'); const msg = box.querySelector('[data-a="msg"]');
    try{
      // @ts-ignore - Custom window property
      const base = window.SEO_LD_ENDPOINT || "/agent/seo/ld";
      const data = await postJSON(`${base}/generate`, { url: location.href, types: types(), dry_run: true });
      // @ts-ignore - HTMLTextAreaElement has value property
      ta.value = JSON.stringify(data.jsonld, null, 2);
      // @ts-ignore - Element exists in DOM
      msg.textContent = `Generated ${data.jsonld.length} object(s). Errors: ${data.report.errors.length}, Warnings: ${data.report.warnings.length}`;
    }catch(e){ 
      // @ts-ignore - Error has message
      msg.textContent = `Failed: ${e.message}`; 
    }
  });

  // @ts-ignore - Element exists in DOM
  box.querySelector('[data-a="val"]').addEventListener("click", async ()=>{
    // @ts-ignore - Element exists in DOM
    const ta = box.querySelector('[data-a="ta"]'); const msg = box.querySelector('[data-a="msg"]'); const res = box.querySelector('[data-a="res"]');
    try{
      // @ts-ignore - Custom window property
      const base = window.SEO_LD_ENDPOINT || "/agent/seo/ld";
      // @ts-ignore - HTMLTextAreaElement has value property
      const rep = await postJSON(`${base}/validate`, { jsonld: JSON.parse(ta.value || "[]") });
      // @ts-ignore - Element exists in DOM
      res.textContent = `Count: ${rep.count} | Errors: ${rep.errors.length} | Warnings: ${rep.warnings.length}`;
      // @ts-ignore - Element exists in DOM
      msg.textContent = "Validated.";
    }catch(e){ 
      // @ts-ignore - Error has message
      msg.textContent = `Failed: ${e.message}`; 
    }
  });

  // @ts-ignore - Element exists in DOM
  box.querySelector('[data-a="copy"]').addEventListener("click", async ()=>{
    // @ts-ignore - Element exists in DOM
    const ta = box.querySelector('[data-a="ta"]'); await navigator.clipboard.writeText(ta.value); box.querySelector('[data-a="msg"]').textContent = "Copied.";
  });

  document.body.append(btn, box);
})();
