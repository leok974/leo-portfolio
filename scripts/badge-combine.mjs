// Combine two strict E2E badge JSON endpoints into one summary badge.
// Inputs: .github/badges/e2e-strict.json & e2e-strict-nginx.json
// Output: .github/badges/e2e-strict-combined.json
import fs from 'node:fs';

const A = '.github/badges/e2e-strict.json';
const B = '.github/badges/e2e-strict-nginx.json';
const OUT = '.github/badges/e2e-strict-combined.json';

function readBadge(p){
  if(!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return null; }
}

const a = readBadge(A);
const b = readBadge(B);
const statusA = (a?.message||'').toLowerCase();
const statusB = (b?.message||'').toLowerCase();
const okA = /pass/.test(statusA);
const okB = /pass/.test(statusB);

const combined = {
  schemaVersion: 1,
  label: 'E2E strict (combined)',
  message: okA && okB ? 'passing' : 'failing',
  color: okA && okB ? 'green' : 'red'
};

fs.mkdirSync('.github/badges', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(combined));
console.log(`[badge-combine] ${OUT}: ${combined.message} (${statusA||'none'} | ${statusB||'none'})`);
