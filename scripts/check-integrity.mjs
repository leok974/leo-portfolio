#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const MANIFEST = resolve(ROOT, 'sri-manifest.json');

function b64(buf) { return buf.toString('base64'); }
async function sha384(filePath) {
  const data = await readFile(filePath);
  const h = createHash('sha384').update(data).digest();
  return `sha384-${b64(h)}`;
}

let manifest;
try {
  manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
} catch (err) {
  console.error(`Failed to read or parse manifest at ${MANIFEST}:`, err.message);
  process.exit(2);
}

let drift = 0;
for (const [path, rec] of Object.entries(manifest)) {
  const abs = resolve(ROOT, path);
  const expected = rec.sha384 || rec.algo || rec.integrity || '';
  let current;
  try {
    current = await sha384(abs);
  } catch (err) {
    console.error(`ERR ${path}\n  expected: ${expected}\n  error   : ${err.message}\n`);
    drift++;
    continue;
  }
  const ok = current === expected;
  if (!ok) drift++;
  console.log(`${ok ? 'OK ' : 'ERR'} ${path}\n  expected: ${expected}\n  current : ${current}\n`);
}

if (drift > 0) {
  console.error(`Integrity drift detected in ${drift} file(s).`);
  process.exit(1);
} else {
  console.log('Integrity check passed.');
}
