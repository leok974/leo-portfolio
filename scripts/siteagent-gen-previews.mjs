#!/usr/bin/env node
/**
 * For each page:
 *  - GET /agent/seo/meta/suggest?path=<page>
 *  - POST /agent/seo/meta/preview?path=<page> with suggested {title,desc}
 * Produces *.apply.json/.diff/.preview.html artifacts.
 */
const base = (arg('--base') || 'http://127.0.0.1:8001').replace(/\/+$/,'');
const pages = (arg('--pages') || '').split(',').map(s => s.trim()).filter(Boolean);
const TRIM = ['1','true','TRUE','yes'].includes(String(arg('--trim')) || '');
const hdrAuth = process.env.API_AUTH ? { 'Authorization': process.env.API_AUTH } : {};
function arg(k){ const i=process.argv.indexOf(k); return i>=0 ? process.argv[i+1] : ''; }

// ---- limits from reviewers config
import fs from 'fs';
import path from 'path';
const CFG = path.join(process.cwd(), '.github', 'seo-meta-reviewers.json');
const cfg = fs.existsSync(CFG) ? JSON.parse(fs.readFileSync(CFG,'utf-8')) : {};
const defaults = (cfg.defaults && cfg.defaults.limits) || { title_max: 60, desc_max: 155 };
const rules = (cfg.rules || []).map(r => ({ re: new RegExp('^' + String(r.glob||'/')
  .replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*\*/g,'.*').replace(/\*/g,'[^/]*') + '$','i'),
  limits: r.limits }));
const limitsFor = (p) => (rules.find(r => r.re.test(p))?.limits) || defaults;
const clamp = (s, n) => {
  if (!s) return s || '';
  if (s.length <= n) return s;
  // try cutoff at last whitespace before limit; fallback hard cut
  const cut = s.slice(0, n);
  const i = cut.lastIndexOf(' ');
  return (i > 30 ? cut.slice(0, i) : cut).trim() + '…';
};

async function suggest(path){
  const u = new URL(base + '/agent/seo/meta/suggest');
  u.searchParams.set('path', path);
  const res = await fetch(u, { headers: { 'Accept':'application/json', ...hdrAuth } });
  if (!res.ok) throw new Error(`suggest ${path} -> ${res.status}`);
  return res.json();
}
async function preview(path, title, desc){
  const u = new URL(base + '/agent/seo/meta/preview');
  u.searchParams.set('path', path);
  const res = await fetch(u, {
    method: 'POST',
    headers: { 'Accept':'application/json', 'Content-Type':'application/json', ...hdrAuth },
    body: JSON.stringify({ title, desc })
  });
  if (!res.ok) throw new Error(`preview ${path} -> ${res.status}`);
  return res.json();
}

(async () => {
  for (const p of pages) {
    try {
      const s = await suggest(p);
      const lim = limitsFor(p);
      let t = s?.suggestion?.title || '';
      let d = s?.suggestion?.desc  || '';
      if (TRIM) {
        t = clamp(t, lim.title_max ?? 60);
        d = clamp(d, lim.desc_max  ?? 155);
      }
      console.log(`→ ${p}  title(${t.length}) desc(${d.length})`);
      await preview(p, t, d);
    } catch (e) {
      console.error(`Failed ${p}:`, e.message || e);
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
