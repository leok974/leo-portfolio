import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const files = [
  'styles.css',
  'assets/hero-poster.webp',
  'assets/hero-showreel.webm',
  'assets/hero-showreel.mp4'
];

function hashPath(p){
  const buf = readFileSync(p);
  const h = createHash('sha1').update(buf).digest('hex').slice(0,10);
  const dot = p.lastIndexOf('.');
  const withHash = dot>0 ? `${p.slice(0,dot)}.${h}${p.slice(dot)}` : `${p}.${h}`;
  renameSync(p, withHash);
  return { old:p, hashed:withHash };
}

const updates = files
  .filter((p) => {
    const ok = existsSync(p);
    if (!ok) console.warn(`[rev] Skip missing: ${p}`);
    return ok;
  })
  .map(hashPath);

// Helper to rewrite a single HTML file with correct relative paths
function rewriteHtml(filePath){
  let html = readFileSync(filePath,'utf8');
  for (const u of updates) {
    // Replace both root-relative and relative references
    const patterns = [
      u.old,
      `./${u.old}`,
      `../${u.old}`
    ].map(s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    for (const p of patterns) {
      const re = new RegExp(p, 'g');
      // Build relative path from this file to the hashed asset
      let replacement = u.hashed;
      if (filePath.includes('\\projects\\') || filePath.includes('/projects/')) {
        // projects/*.html are one level deeper
        replacement = u.hashed.startsWith('assets/') || u.hashed.startsWith('styles') ? `../${u.hashed}` : `../${u.hashed}`;
      }
      html = html.replace(re, replacement);
    }
  }
  writeFileSync(filePath, html);
}

// Rewrite root index.html
rewriteHtml('index.html');

// Rewrite project pages
const projDir = 'projects';
try {
  const list = readdirSync(projDir).filter(f => f.endsWith('.html'));
  for (const f of list) rewriteHtml(join(projDir, f));
} catch {}

console.log('Rewritten HTML files with hashed asset names:', updates);
