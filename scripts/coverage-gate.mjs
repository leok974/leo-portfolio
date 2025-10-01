// scripts/coverage-gate.mjs - enforce coverage thresholds (env overrides supported)
import fs from 'node:fs';

const path = process.env.COV_SUMMARY || 'coverage/coverage-summary.json';
if (!fs.existsSync(path)) {
  console.error(`[gate] missing ${path} — run tests with coverage first (npm run coverage)`);
  process.exit(2);
}
const total = JSON.parse(fs.readFileSync(path, 'utf8')).total;

const thresholds = {
  lines: Number(process.env.COV_LINES ?? 80),
  statements: Number(process.env.COV_STATEMENTS ?? 80),
  functions: Number(process.env.COV_FUNCTIONS ?? 70),
  branches: Number(process.env.COV_BRANCHES ?? 60)
};

const actual = {
  lines: total.lines.pct,
  statements: total.statements.pct,
  functions: total.functions.pct,
  branches: total.branches.pct
};

const failures = Object.entries(thresholds)
  .filter(([k, min]) => (actual[k] ?? 0) < min)
  .map(([k, min]) => `${k} ${actual[k]} < ${min}`);

if (failures.length) {
  console.error('[gate] coverage failed:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log(`[gate] ok — L${actual.lines} S${actual.statements} F${actual.functions} B${actual.branches}`);
