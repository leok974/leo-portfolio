#!/usr/bin/env node
// coverage-shield.mjs
// Generates Shields.io-compatible JSON badge endpoints from coverage/coverage-summary.json
// Outputs to .github/badges:
//   coverage.json   -> combined lines/branches/functions
//   lines.json      -> lines coverage only
//   branches.json   -> branches coverage only
//   functions.json  -> functions coverage only
// Color bands: >=95 brightgreen, >=90 green, >=80 yellowgreen, >=70 yellow, >=60 orange, else red

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const covPath = path.join(root, 'coverage', 'coverage-summary.json');
const outDir = path.join(root, '.github', 'badges');

if (!fs.existsSync(covPath)) {
  console.error(`[coverage-shield] coverage-summary.json not found at ${covPath}`);
  process.exit(2);
}

/** @typedef {{ total: { lines: { pct:number }; branches:{ pct:number }; functions:{ pct:number }; statements:{ pct:number } } }} Summary */
/** @type {Summary} */
const summary = JSON.parse(fs.readFileSync(covPath, 'utf8'));

const safePct = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);
const lines = safePct(summary.total.lines.pct);
const branches = safePct(summary.total.branches.pct);
const functions = safePct(summary.total.functions.pct);
const statements = safePct(summary.total.statements?.pct);

const band = (v) => (v >= 95 ? 'brightgreen' : v >= 90 ? 'green' : v >= 80 ? 'yellowgreen' : v >= 70 ? 'yellow' : v >= 60 ? 'orange' : 'red');
const shield = (label, message, color) => ({ schemaVersion: 1, label, message, color });

fs.mkdirSync(outDir, { recursive: true });

const comboMsg = `L ${Math.round(lines)} | B ${Math.round(branches)} | F ${Math.round(functions)} | S ${Math.round(statements)}`;
const comboColor = band(Math.min(lines, branches, functions, statements));
fs.writeFileSync(path.join(outDir, 'coverage.json'), JSON.stringify(shield('coverage', comboMsg, comboColor)));
fs.writeFileSync(path.join(outDir, 'lines.json'), JSON.stringify(shield('lines', `${Math.round(lines)}%`, band(lines))));
fs.writeFileSync(path.join(outDir, 'branches.json'), JSON.stringify(shield('branches', `${Math.round(branches)}%`, band(branches))));
fs.writeFileSync(path.join(outDir, 'functions.json'), JSON.stringify(shield('functions', `${Math.round(functions)}%`, band(functions))));
fs.writeFileSync(path.join(outDir, 'statements.json'), JSON.stringify(shield('statements', `${Math.round(statements)}%`, band(statements))));

console.log(`[coverage-shield] Wrote badges to ${outDir}`);
