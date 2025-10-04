#!/usr/bin/env node
// Multi-file latency rollup for Playwright JSON reports.
// Usage examples:
//   node scripts/stream-latency-report.mjs                         # defaults to playwright-report/results.json
//   node scripts/stream-latency-report.mjs playwright-report/*.json
//   node scripts/stream-latency-report.mjs playwright-report       # directory → all *.json inside
//   node scripts/stream-latency-report.mjs run1.json run2.json
//
// Outputs an overall table and a per-provider table (if provider annotations exist).
// Appends both tables to GITHUB_STEP_SUMMARY when available.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const defaultFile = 'playwright-report/results.json';

// --- tiny glob for patterns like "dir/*.json"
function expandArg(p) {
  if (!p) return [defaultFile];
  try {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      return fs.readdirSync(p)
        .filter(f => f.toLowerCase().endsWith('.json'))
        .map(f => path.join(p, f));
    }
  } catch { /* not a file nor dir; maybe a pattern */ }

  if (/[?*]/.test(p)) {
    const dir = path.dirname(p);
    const pat = path.basename(p);
    const re = new RegExp('^' + pat
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.') + '$', 'i');
    const base = dir === '.' ? process.cwd() : dir;
    try {
      return fs.readdirSync(base)
        .filter(f => re.test(f))
        .map(f => path.join(base, f));
    } catch {
      return [];
    }
  }

  return [p];
}

const inputs = (args.length ? args : [defaultFile]).flatMap(expandArg);
const unique = [...new Set(inputs)].filter(f => {
  try { return fs.statSync(f).isFile(); } catch { return false; }
});

if (!unique.length) {
  console.error('[latency-report] no input JSON files found');
  process.exit(0);
}

// --- collect annotations across all files
function visit(node, sink) {
  if (!node) return;

  const pushFrom = (anns = []) => {
    if (!anns.length) return;
    const ms = anns.find(a => a?.type === 'stream-first-token-ms');
    if (ms && ms.description != null) {
      const v = Number(ms.description);
      if (!Number.isNaN(v)) {
        const prov = (anns.find(a => a?.type === 'stream-provider')?.description || 'unknown').toString();
        sink.push({ ms: v, provider: prov });
      }
    }
  };

  const processTests = (tests = []) => {
      for (const t of tests) {
        pushFrom(t.annotations);
        for (const result of t.results || []) {
          pushFrom(result.annotations);
        }
      }
    };

    processTests(node.tests);

    const specs = node.specs || [];
    for (const spec of specs) {
      processTests(spec.tests);
    }

  const suites = node.suites || [];
  for (const s of suites) visit(s, sink);
}

const rows = [];
for (const f of unique) {
  try {
    const json = JSON.parse(fs.readFileSync(f, 'utf8'));
    visit(json, rows);
  } catch (e) {
    console.warn(`[latency-report] skipping ${f}: ${String(e.message || e)}`);
  }
}

if (!rows.length) {
  console.log('[latency-report] no stream-first-token-ms annotations found');
  process.exit(0);
}

function stats(values) {
  const v = [...values].sort((a,b)=>a-b);
  const n = v.length;
  const idx = q => Math.min(n-1, Math.max(0, Math.ceil(q*n) - 1));
  const sum = v.reduce((a,b)=>a+b,0);
  return {
    count: n,
    min: v[0],
    p50: v[idx(0.50)],
    p90: v[idx(0.90)],
    p95: v[idx(0.95)],
    p99: v[idx(0.99)],
    max: v[n-1],
    mean: Math.round(sum / n)
  };
}

function asTable(title, s) {
  return (
`### ${title}
| metric | ms |
|---|---:|
| count | ${s.count} |
| min | ${s.min} |
| p50 | ${s.p50} |
| p90 | ${s.p90} |
| p95 | ${s.p95} |
| p99 | ${s.p99} |
| max | ${s.max} |
| mean | ${s.mean} |
`);
}

// overall
const overall = stats(rows.map(r => r.ms));
const pieces = [];
pieces.push(asTable('Stream first-token latency (overall)', overall));

// per provider
const byProv = new Map();
for (const r of rows) {
  const k = r.provider || 'unknown';
  if (!byProv.has(k)) byProv.set(k, []);
  byProv.get(k).push(r.ms);
}

if (byProv.size > 1 || byProv.has('unknown')) {
  for (const [prov, vals] of byProv.entries()) {
    pieces.push(asTable(`Provider: ${prov}`, stats(vals)));
  }
}

const output = pieces.join('\n');
console.log(output.trim());

// write to GitHub step summary if available
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '\n' + output + '\n');
}
