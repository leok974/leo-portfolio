#!/usr/bin/env node
// Update the committed assets digest baseline, suppressing timestamp-only churn.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const SRC = process.env.DIGEST_SOURCE || path.resolve('assets-digests.json');
const DEST = path.resolve('scripts/assets-digests-baseline.json');
const AUTO_COMMIT = process.env.AUTO_COMMIT === '1';
const FORCE = process.env.FORCE === '1' || process.argv.includes('--force');

const log = (m) => console.log(`[assets:baseline] ${m}`);
const warn = (m) => console.warn(`[assets:baseline] WARN: ${m}`);
const fail = (m) => { console.error(`[assets:baseline] ERROR: ${m}`); process.exit(1); };

if (!fs.existsSync(SRC)) fail(`Source digest file not found: ${SRC}. Run pnpm run verify:static first.`);

let current;
try { current = JSON.parse(fs.readFileSync(SRC,'utf8')); } catch { fail('Failed to parse source JSON.'); }
if (!current.digests) fail('Source file missing digests map (expected keyed manifest).');

// Build comparable objects excluding generatedAt noise field.
const strip = (o) => { const c = { ...o }; delete c.generatedAt; return c; };
const hash = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');

let previousComparable = null;
if (fs.existsSync(DEST)) {
  try {
    const prev = JSON.parse(fs.readFileSync(DEST,'utf8'));
    previousComparable = strip(prev);
  } catch { warn('Existing baseline unreadable, treating as changed.'); }
}

const nextComparable = strip(current);
const changed = FORCE || !previousComparable || hash(previousComparable) !== hash(nextComparable);

if (!changed) {
  log('No digest changes (only timestamp differs) — skipping write. Use --force or FORCE=1 to override.');
  process.exit(0);
}

fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.writeFileSync(DEST, JSON.stringify(current, null, 2) + '\n');
log(`Updated baseline → ${DEST}`);

if (AUTO_COMMIT) {
  try {
    execSync(`git add "${DEST}"`, { stdio:'inherit' });
    execSync('git commit -m "chore(assets): refresh digests baseline"', { stdio:'inherit' });
    log('Auto-commit complete.');
  } catch (e) {
    warn(`Auto-commit skipped: ${e.message}`);
  }
} else {
  log('To commit manually: git add scripts/assets-digests-baseline.json && git commit -m "chore(assets): refresh digests baseline"');
}
