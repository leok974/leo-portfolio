#!/usr/bin/env node

const BASE = process.env.BASE || 'http://127.0.0.1:8080';
const TIMEOUT = Number(process.env.STREAM_TIMEOUT_MS || 15000);

const u = (p) => `${BASE}${p}`;
const ok = (cond, msg) => { if (!cond) { throw new Error(msg); } };

async function fetchText(path){
  const res = await fetch(u(path));
  ok(res.ok, `GET ${path} -> ${res.status}`);
  return res.text();
}
async function fetchHead(path){
  const res = await fetch(u(path), { method: 'HEAD' });
  ok(res.ok, `HEAD ${path} -> ${res.status}`);
  return res;
}

console.log('BASE:', BASE);

// HTML & CSS link extraction
const html = await fetchText('/');
const cssMatch = html.match(/href="(\/assets\/[^"']+\.css)"/);
const cssHref = cssMatch && cssMatch[1];
ok(cssHref, 'No CSS asset link found');
const cssHead = await fetchHead(cssHref);
const ct = (cssHead.headers.get('content-type')||'').toLowerCase();
ok(ct.includes('text/css'), 'CSS content-type mismatch');
const cc = (cssHead.headers.get('cache-control')||'').toLowerCase();
ok(cc.includes('immutable'), 'CSS missing immutable cache-control');

// Streaming check
const body = JSON.stringify({ messages: [{ role: 'user', content: 'hello with _served_by' }] });
const resp = await fetch(u('/chat/stream'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
ok(resp.ok, `stream HTTP ${resp.status}`);
ok(resp.body, 'No response body for stream');

const reader = resp.body.getReader();
const td = new (globalThis.TextDecoder || (await import('node:util')).TextDecoder)();
let bytes = 0; let buf = '';
const deadline = Date.now() + TIMEOUT;
while (Date.now() < deadline) {
  const { value, done } = await reader.read();
  if (done) break;
  bytes += value.length;
  buf += td.decode(value, { stream: true });
  if (/_served_by/i.test(buf)) break;
}
ok(bytes > 0, 'No stream bytes read');
console.log('OK ✓  css + streaming (bytes:', bytes, ')');
