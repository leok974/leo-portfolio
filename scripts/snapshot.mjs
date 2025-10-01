#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const root = process.cwd();
const excludeDirs = new Set(['.git', '.venv', 'node_modules', '__pycache__', '.pytest_cache', '.mypy_cache', '.vscode']);
const excludeFiles = new Set(['repo-snapshot.json']);

function rel(p) {
  return path.relative(root, p).split(path.sep).join('/');
}

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (excludeDirs.has(e.name)) continue;
      walk(full, out);
    } else if (e.isFile()) {
      if (excludeFiles.has(e.name)) continue;
      out.push(full);
    }
  }
}

async function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

async function main() {
  const files = [];
  walk(root, files);
  files.sort();
  const out = [];
  for (const f of files) {
    try {
      const st = fs.statSync(f);
      const hash = await sha256(f);
      out.push({ path: rel(f), size: st.size, mtime: new Date(st.mtimeMs).toISOString(), sha256: hash });
  } catch (_err) {
      // If hashing fails, still capture the metadata without hash
      try {
        const st = fs.statSync(f);
        out.push({ path: rel(f), size: st.size, mtime: new Date(st.mtimeMs).toISOString(), sha256: null });
      } catch {}
    }
  }
  const meta = { root: rel(root) || '.', createdUtc: new Date().toISOString(), count: out.length };
  const snapshot = { meta, files: out };
  const json = JSON.stringify(snapshot, null, 2);
  fs.writeFileSync(path.join(root, 'repo-snapshot.json'), json);
  console.log(`repo-snapshot.json written with ${out.length} files`);
}

main().catch((_e) => {
  console.error('Snapshot failed:', _e);
  process.exit(1);
});
