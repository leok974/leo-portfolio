#!/usr/bin/env node
/**
 * Convert JSONL (one JSON per line) to CSV.
 * Input (default): agent/metrics/seo-meta-auto.jsonl
 * Output (default): agent/metrics/seo-meta-auto.csv
 * Options:
 *   --in   <path-to-jsonl>
 *   --out  <path-to-csv>
 *   --limit-days <N>   # keep only last N days (by ts)
 */
import fs from 'fs';
import path from 'path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => a.startsWith('--')
    ? [a.slice(2), (arr[i+1] && !arr[i+1].startsWith('--')) ? arr[i+1] : '']
    : null).filter(Boolean)
);

const IN  = args.in  || 'agent/metrics/seo-meta-auto.jsonl';
const OUT = args.out || 'agent/metrics/seo-meta-auto.csv';
const LIMIT_DAYS = parseInt(args['limit-days'] || '0', 10);

if (!fs.existsSync(IN)) {
  console.error(`Input JSONL not found: ${IN}`);
  process.exit(1);
}

const lines = fs.readFileSync(IN, 'utf-8').split(/\r?\n/).filter(Boolean);
let rows = [];
for (const line of lines) {
  try { rows.push(JSON.parse(line)); } catch {}
}

const toDate = (s) => new Date(s);
if (LIMIT_DAYS > 0) {
  const now = Date.now();
  const cutoff = now - LIMIT_DAYS * 24 * 60 * 60 * 1000;
  rows = rows.filter(r => +toDate(r.ts) >= cutoff);
}

rows.sort((a,b) => +toDate(a.ts) - +toDate(b.ts));

const cols = [
  'ts','repo','run_id','run_number',
  'pages_count','over_count','skipped','reason',
  'pr_number','pr_url'
];
const esc = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
};
const csv = [cols.join(',')]
  .concat(rows.map(r => cols.map(c => esc(r[c])).join(',')))
  .join('\n');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, csv, 'utf-8');

console.log(`Wrote CSV: ${OUT} (${rows.length} rows)`);
