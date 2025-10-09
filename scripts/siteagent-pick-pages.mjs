#!/usr/bin/env node
/**
 * Select N pages to optimize:
 * 1) Try /agent/analytics/report underperformers (CTR < 2)
 * 2) Fallback to /agent/status/pages
 * Outputs: pages=<comma-separated> to GITHUB_OUTPUT
 */
const base = (arg('--base') || 'http://127.0.0.1:8001').replace(/\/+$/,'');
const limit = parseInt(arg('--limit') || '3', 10);
const exclude = (arg('--exclude') || '').split(',').map(s => s.trim()).filter(Boolean);
const hdrAuth = process.env.API_AUTH ? { 'Authorization': process.env.API_AUTH } : {};
const outFile = process.env.GITHUB_OUTPUT;

function arg(k){ const i=process.argv.indexOf(k); return i>=0 ? process.argv[i+1] : ''; }
function globToRe(g){ let s=g.replace(/[.+^${}()|[\]\\]/g,'\\$&'); s=s.replace(/\*\*/g,'.*').replace(/\*/g,'[^/]*'); if(!s.startsWith('/')) s='/'+s; return new RegExp('^'+s+'$','i'); }
function excludeFilter(paths){ const regs=exclude.map(globToRe); return paths.filter(p => !regs.some(r=>r.test(p))); }

async function getJSON(pathname){
  const res = await fetch(base + pathname, { headers: { 'Accept':'application/json', ...hdrAuth } });
  if (!res.ok) throw new Error(`${pathname} -> ${res.status}`);
  return res.json();
}

(async () => {
  let candidates = [];
  try {
    const rep = await getJSON('/agent/analytics/report'); // { underperformers: [{path, ctr}, ...] }
    const rows = (rep.underperformers || []).filter(r => parseFloat(r.ctr || 100) < 2.0);
    candidates = rows.map(r => r.path).filter(Boolean);
  } catch (_) {
    // ignore
  }
  if (!candidates.length) {
    try {
      const st = await getJSON('/agent/status/pages');  // { pages: [{path,...}] }
      candidates = (st.pages || []).map(p => p.path).filter(Boolean);
    } catch (_) {}
  }
  candidates = excludeFilter(candidates);
  const picked = Array.from(new Set(candidates)).slice(0, Math.max(0, limit));
  const line = `pages=${picked.join(',')}`;
  const count = `count=${picked.length}`;
  console.log(line);
  console.log(count);
  if (outFile) {
    require('fs').appendFileSync(outFile, line + '\n');
    require('fs').appendFileSync(outFile, count + '\n');
  }
  // exit 0 even when empty; gating happens in workflow
})().catch(e => { console.error(e); process.exit(1); });
