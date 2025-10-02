#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const args = new Map(process.argv.slice(2).map(a => a.split('=')));
const htmlPath = args.get('--html') || 'dist/index.html';
const confPath = args.get('--conf') || 'deploy/nginx.conf';

if (!fs.existsSync(htmlPath)) {
  console.error(`HTML file not found: ${htmlPath}`);
  process.exit(0); // non-fatal for CI fast path (may run before build fallback)
}

const html = fs.readFileSync(htmlPath, 'utf8');

// Collect inline script blocks (excluding module preload tags with src)
const scripts = [...html.matchAll(/<script(?![^>]*src=)(?:[^>]*?)>([\s\S]*?)<\/script>/gi)]
  .map(m => m[1].trim())
  .filter(s => s.length);

if (!scripts.length) {
  console.error('No inline <script> blocks found in dist/index.html; nothing to hash.');
  process.exit(0);
}

const payload = scripts.join('\n');
const hash = crypto.createHash('sha256').update(payload, 'utf8').digest('base64');
const token = `sha256-${hash}`;

let conf = fs.readFileSync(confPath, 'utf8');

const replaced = conf
  .replace(/(set\s+\$csp_policy\s+"[^"]*?)sha256-[A-Za-z0-9+/=]+/g, `$1${token}`)
  .replace(/(add_header\s+Content-Security-Policy\s+"[^"]*?)sha256-[A-Za-z0-9+/=]+/g, `$1${token}`);

if (replaced === conf) {
  console.warn('No CSP sha256 placeholder found to replace in deploy/nginx.conf.');
} else {
  fs.writeFileSync(confPath, replaced);
  console.log(`Updated CSP hash in ${confPath} -> ${token}`);
}
