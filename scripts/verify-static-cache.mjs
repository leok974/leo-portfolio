#!/usr/bin/env node
import http from 'node:http';
import https from 'node:https';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:8080';

function fetchText(url) {
  const lib = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    lib.get(url, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: data }));
    }).on('error', reject);
  });
}

function fetchBuffer(url) {
  const lib = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    lib.get(url, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, buffer: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}


function extractAssets(html) {
  const urls = new Set();
  const patterns = [
    /<script[^>]+src=["']([^"']+\/assets\/[^"']+\.m?js)["']/gi,
    /<link[^>]+href=["']([^"']+\/assets\/[^"']+\.css)["']/gi,
    /<link[^>]+href=["']([^"']+\/assets\/[^"']+\.woff2?)["']/gi,
    /<img[^>]+src=["']([^"']+\/assets\/[^"']+\.(?:png|jpe?g|webp|gif|svg))["']/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html))) urls.add(m[1]);
  }
  if (urls.size === 0) {
    // Generic fallback: capture any quoted /assets/ path with allowed extensions
    const generic = /["'](\/assets\/[A-Za-z0-9._-]+\.(?:m?js|css|woff2?|png|jpe?g|webp|gif|svg))["']/g;
    let m;
    while ((m = generic.exec(html))) urls.add(m[1]);
  }
  return [...urls];
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const root = await fetchText(`${BASE}/`);
  expect(root.status === 200, `GET / failed: ${root.status}`);
  const assets = extractAssets(root.text);
  if (!assets.length) {
    // Emit debug context for troubleshooting
    const sample = root.text.split(/\n/).filter(l => l.includes('/assets/')).slice(0, 20);
    console.error('Asset extraction debug: first lines containing /assets/ =>');
    console.error(sample.join('\n'));
  }
  expect(assets.length > 0, 'No /assets/*.js|*.css|*.woff2|image assets found in HTML');

  const failures = [];
  const digests = {};
  for (const path of assets) {
    const url = path.startsWith('http') ? path : `${BASE}${path}`;
    // Use full GET to compute digest directly (simplifies logic)
    const res = await fetchBuffer(url);
    const cc = (res.headers['cache-control'] || '').toLowerCase();
    const ct = (res.headers['content-type'] || '').toLowerCase();
    const ok =
      res.status === 200 &&
      cc.includes('immutable') &&
      (ct.includes('javascript') ||
        ct.includes('css') ||
        ct.includes('font') ||
        ct.startsWith('image/'));
    if (!ok) failures.push({ url, status: res.status, cc, ct });
    const sha256 = createHash('sha256').update(res.buffer).digest('hex');
    digests[path] = { sha256, contentType: ct, cacheControl: cc };
  }

  if (failures.length) {
    console.error('Static cache verification failed:', failures);
    process.exit(1);
  }
  // Write legacy array manifest (kept for backward compatibility)
  const arrayOut = process.env.MANIFEST_OUT || 'asset-digests.json';
  const arrayManifest = Object.entries(digests).map(([path, meta]) => ({ path, ...meta }));
  fs.writeFileSync(arrayOut, JSON.stringify({ base: BASE, generated: new Date().toISOString(), assets: arrayManifest }, null, 2));
  // Write new keyed digest map
  const mapOut = process.env.DIGEST_MAP_OUT || 'assets-digests.json';
  fs.writeFileSync(mapOut, JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, digests }, null, 2));
  console.log(`Static cache OK for ${assets.length} assets. Manifests written: ${arrayOut}, ${mapOut}`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
