#!/usr/bin/env node
/**
 * Regenerates CSP baseline (scripts/expected-csp.txt) by performing an HTTP HEAD/GET
 * against a running local prod-like stack (default http://localhost:8080/).
 * Usage: node scripts/csp-baseline.mjs [--url http://localhost:8080/]
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

function parseArgs(){
  const out = { url: 'http://localhost:8080/' };
  const argv = process.argv.slice(2);
  for (let i=0;i<argv.length;i++) {
    if (argv[i] === '--url' && argv[i+1]) { out.url = argv[++i]; continue; }
  }
  return out;
}

const { url } = parseArgs();
console.error(`[csp-baseline] Fetching CSP from ${url}`);

let headerLine = '';
try {
  // Use curl for reliability (HEAD sometimes strips CSP if misconfigured, so force -I first then fallback)
  const head = execSync(`curl -sI ${url}`, { stdio: ['ignore','pipe','pipe'] }).toString();
  const match = head.split(/\r?\n/).find(l => /content-security-policy/i.test(l));
  if (match) headerLine = match.trim();
  if (!headerLine) {
    const get = execSync(`curl -sD - ${url} -o /dev/null`, { stdio: ['ignore','pipe','pipe'] }).toString();
    const match2 = get.split(/\r?\n/).find(l => /content-security-policy/i.test(l));
    if (match2) headerLine = match2.trim();
  }
} catch (err) {
  console.error('[csp-baseline] Error invoking curl:', err.message);
  process.exit(1);
}

if (!headerLine) {
  console.error('[csp-baseline] Failed to locate CSP header. Is the stack running?');
  process.exit(2);
}

// Normalize to single space formatting for consistency with Playwright spec
const norm = headerLine.replace(/\s+/g, ' ');
fs.writeFileSync('scripts/expected-csp.txt', norm + (norm.endsWith('\n') ? '' : '\n'));
console.log('[csp-baseline] Updated scripts/expected-csp.txt');
