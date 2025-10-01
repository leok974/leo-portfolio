#!/usr/bin/env node
/**
 * generate-sri.mjs
 * Scans target HTML files (default: index.html + projects/*.html) and updates <link rel="stylesheet"> and
 * <script type="module"> tags pointing to local assets with integrity="sha384-..." and crossorigin="anonymous".
 * Uses SHA-384 (recommended) and base64 encodes digest. Rewrites HTML in place only if content changes.
 *
 * Usage:
 *   node scripts/generate-sri.mjs --root . --html "index.html,projects/*.html" --assets dist
 * If no dist/ build yet, can run on repository root static assets (styles.*.css, assets/site.css, /src output after build copy).
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { glob } from 'glob';
import path from 'node:path';

const args = process.argv.slice(2);
// Simple arg parser (supports --key=value or --key value). Stop-gap to avoid mis-parsing comma list as boolean.
const opts = {};
for (let i=0; i<args.length; i++) {
  const token = args[i];
  if (!token.startsWith('--')) continue;
  const eq = token.indexOf('=');
  if (eq !== -1) {
    const k = token.slice(2, eq); const v = token.slice(eq+1); opts[k] = v; continue;
  }
  const k = token.slice(2);
  const next = args[i+1];
  if (next && !next.startsWith('--')) { opts[k] = next; i++; }
  else { opts[k] = 'true'; }
}
const root = path.resolve(opts.root || '.');
const htmlPatterns = (opts.html || 'index.html,projects/*.html').split(',');
const manifestName = opts.manifest || 'sri-manifest.json';
const manifestPath = path.isAbsolute(manifestName) ? manifestName : path.join(root, manifestName);
let manifestRaw = existsSync(manifestPath) && opts.incremental !== 'false' ? JSON.parse(readFileSync(manifestPath,'utf8')) : {};
// Normalize manifest to structured objects { sha384: "sha384-..." }
const manifest = {};
for (const [k,v] of Object.entries(manifestRaw)) {
  if (v && typeof v === 'object' && 'sha384' in v) manifest[k] = v;
  else if (typeof v === 'string') manifest[k] = { sha384: v };
}

// Accept additional asset directory (e.g., dist) but default to repository root for existing static names
const assetBase = path.resolve(root, opts.assets || '.');

function sha384(filePath){
  const data = readFileSync(filePath);
  const h = createHash('sha384').update(data).digest('base64');
  return `sha384-${h}`;
}

// Collect candidate local assets referenced from HTML (CSS + JS modules + fonts)
function processHtmlFile(file){
  const original = readFileSync(file, 'utf8');
  let updated = original;
  let changed = false;
  // Regex for <link rel="stylesheet" href="...">, preload stylesheet, font links (.woff2), and <script type="module" src="...">
  const linkRegex = /<link([^>]*?)href="([^"]+\.(?:css|woff2))"([^>]*)>/g;
  const scriptRegex = /<script([^>]*?)src="([^"]+\.(?:js))"([^>]*)><\/script>/g;

  function replaceTag(match, preAttrs, href, postAttrs){
    // Always record manifest entry even if integrity already present
    // Resolve on-disk path; support relative like ../assets/site.css
    const rel = href.replace(/^\//,'');
    const candidates = [path.join(root, rel), path.join(assetBase, rel)];
    const existing = candidates.find(p => existsSync(p));
    if(!existing) return match; // skip external or missing
    const integrity = sha384(existing);
    manifest[rel] = { sha384: integrity };
    const hasIntegrity = / integrity=("|')([^"']+)("|')/i.exec(match);
    const hasCross = / crossorigin=/i.test(match);
    if (hasIntegrity) {
      // Replace if empty or mismatched
      if (!hasIntegrity[2] || hasIntegrity[2] !== integrity) {
        const rebuilt = match.replace(/ integrity=("|')(.*?)("|')/i, ` integrity="${integrity}"`).replace(/>$/, m=> !hasCross ? m.replace(/>$/, ' crossorigin="anonymous">') : m);
        if (rebuilt !== match) changed = true;
        return rebuilt;
      }
      // Already matches
      if (!hasCross) {
        const rebuilt = match.replace(/>$/, ' crossorigin="anonymous">');
        if (rebuilt !== match) changed = true;
        return rebuilt;
      }
      return match;
    } else {
      const crossorigin = hasCross ? '' : ' crossorigin="anonymous"';
      const rebuilt = `<link${preAttrs}href="${href}" integrity="${integrity}"${postAttrs}${crossorigin}>`;
      if (rebuilt !== match) changed = true;
      return rebuilt;
    }
  }

  function replaceScript(match, preAttrs, src, postAttrs){
    if (/\b(type|module)\b/i.test(match) === false) return match; // only module scripts
    const rel = src.replace(/^\//,'');
    const candidates = [path.join(root, rel), path.join(assetBase, rel)];
    const existing = candidates.find(p => existsSync(p));
    if(!existing) return match;
    const integrity = sha384(existing);
    manifest[rel] = { sha384: integrity };
    const hasIntegrity = / integrity=("|')([^"']+)("|')/i.exec(match);
    const hasCross = / crossorigin=/i.test(match);
    if (hasIntegrity) {
      if (!hasIntegrity[2] || hasIntegrity[2] !== integrity) {
        const rebuilt = match.replace(/ integrity=("|')(.*?)("|')/i, ` integrity="${integrity}"`).replace(/>$/, m=> !hasCross ? m.replace(/>$/, ' crossorigin="anonymous">') : m);
        if (rebuilt !== match) changed = true;
        return rebuilt;
      }
      if (!hasCross) {
        const rebuilt = match.replace(/>$/, ' crossorigin="anonymous">');
        if (rebuilt !== match) changed = true;
        return rebuilt;
      }
      return match;
    } else {
      const crossorigin = hasCross ? '' : ' crossorigin="anonymous"';
      const rebuilt = `<script${preAttrs}src="${src}" integrity="${integrity}"${postAttrs}${crossorigin}></script>`;
      if (rebuilt !== match) changed = true;
      return rebuilt;
    }
  }

  updated = updated.replace(linkRegex, replaceTag);
  updated = updated.replace(scriptRegex, replaceScript);

  if (changed && updated !== original){
    writeFileSync(file, updated, 'utf8');
    console.log(`Updated SRI: ${path.relative(root, file)}`);
  } else {
    console.log(`No change: ${path.relative(root, file)}`);
  }
}

async function main(){
  const htmlFiles = (await Promise.all(htmlPatterns.map(p => glob(p, { cwd: root, nodir:true }))))
    .flat()
    .map(f => path.join(root, f));
  if(!htmlFiles.length){
    console.error('No HTML files matched patterns:', htmlPatterns.join(', '));
    process.exit(2);
  }
  htmlFiles.forEach(processHtmlFile);
  // Emit manifest (sorted keys for deterministic output)
  const ordered = Object.fromEntries(Object.keys(manifest).sort().map(k => [k, manifest[k]]));
  writeFileSync(manifestPath, JSON.stringify(ordered, null, 2) + '\n');
  console.log(`Wrote manifest: ${path.relative(root, manifestPath)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
