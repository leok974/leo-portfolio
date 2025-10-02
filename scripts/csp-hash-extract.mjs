// scripts/csp-hash-extract.mjs
// Usage:
//   node scripts/csp-hash-extract.mjs --html index.html [--conf deploy/nginx/nginx.prod.conf]
// Generates SHA-256 hashes for inline <script> blocks (no src attribute) including JSON-LD.
// Produces .github/csp/inline-script-hashes.json and optionally patches a placeholder
// __INLINE_SCRIPT_HASHES__ inside the provided nginx conf.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Arg parsing
const rawArgs = process.argv.slice(2);
const args = {};
for (let i = 0; i < rawArgs.length; i++) {
  const v = rawArgs[i];
  if (v.startsWith('--')) {
    const key = v.slice(2);
    const val = rawArgs[i + 1] && !rawArgs[i + 1].startsWith('--') ? rawArgs[++i] : '1';
    args[key] = val;
  }
}

if (!args.html) {
  console.error('Required: --html <path to index.html>');
  process.exit(2);
}

const htmlPath = args.html;
let html;
try {
  html = readFileSync(htmlPath, 'utf8');
} catch (e) {
  console.error('Failed to read HTML file:', htmlPath, e.message);
  process.exit(3);
}

// Regex finds <script ...> ... </script> blocks without src attribute.
const re = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gim;
const hashes = [];
let m;
while ((m = re.exec(html)) !== null) {
  const body = (m[1] || '').trim();
  if (!body) continue; // skip empty blocks
  const b64 = createHash('sha256').update(body, 'utf8').digest('base64');
  hashes.push(`'sha256-${b64}'`);
}

const unique = [...new Set(hashes)];
const list = unique.join(' ');

console.log('\nCSP script-src hashes:');
console.log(list || '(none)');
console.log('');

// Write artifact
const outPath = '.github/csp/inline-script-hashes.json';
import('node:fs/promises').then(async (fsp) => {
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  const payload = {
    generated_at: new Date().toISOString(),
    input: path.resolve(htmlPath),
    count: unique.length,
    hashes: unique,
  };
  await fsp.writeFile(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${outPath}`);
}).catch(e => {
  console.warn('Failed writing hash artifact:', e.message);
});

// Optional patch
if (args.conf) {
  try {
    const placeholder = '__INLINE_SCRIPT_HASHES__';
    const confPath = args.conf;
    const confContent = readFileSync(confPath, 'utf8');
    if (confContent.includes(placeholder)) {
      const patched = confContent.replace(placeholder, list);
      writeFileSync(confPath, patched);
      console.log(`Patched ${confPath} (replaced ${placeholder}).`);
    } else {
      console.log(`Note: ${confPath} has no ${placeholder}; paste hashes manually.`);
    }
  } catch (e) {
    console.warn('Failed patching conf:', e.message);
  }
}
