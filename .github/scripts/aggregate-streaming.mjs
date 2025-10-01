#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const srcDir = '.github/badges';
const out = `${srcDir}/streaming-combined.json`;

function load(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}
function statusOf(badge) {
  if (!badge) return 'skip';
  const msg = (badge.message || '').toLowerCase();
  if (msg.includes('pass')) return 'pass';
  if (msg.includes('fail')) return 'fail';
  if (msg.includes('skip')) return 'skip';
  return 'unknown';
}

const strict = load(`${srcDir}/streaming.json`);
const fallback = load(`${srcDir}/streaming-fallback.json`);
const s = statusOf(strict);
const f = statusOf(fallback);

let color = 'lightgrey';
let message = `strict:${s} | fallback:${f}`;
if (s === 'pass' && f === 'pass') color = 'brightgreen';
else if (s === 'pass' && (f === 'fail' || f === 'skip')) color = 'yellowgreen';
else if (f === 'pass' && (s === 'fail' || s === 'skip')) color = 'yellow';
else if (s === 'fail' && f === 'fail') color = 'red';

const combined = { schemaVersion: 1, label: 'streaming', message, color };
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(combined));
console.log('Wrote', out, combined);
