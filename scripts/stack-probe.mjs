#!/usr/bin/env node
// Quick multi-endpoint probe for edge/backend/model reachability
import http from 'node:http';
import { URL } from 'node:url';

const EDGE = process.env.EDGE_BASE || process.env.BASE_URL || 'http://127.0.0.1:8080';
const BACK = process.env.BACKEND_BASE || 'http://127.0.0.1:8001';
const direct = process.env.BACKEND_DIRECT === '1';

const targets = [
  { name: 'edge _up', url: `${EDGE}/_up` },
  { name: 'edge api/ready', url: `${EDGE}/api/ready` },
  { name: 'edge api/status/summary', url: `${EDGE}/api/status/summary` },
  { name: 'back ready', url: `${BACK}/ready` },
  { name: 'back status/summary', url: `${BACK}/status/summary` },
  { name: 'back api/status/summary', url: `${BACK}/api/status/summary` },
  { name: 'back llm ping', url: `${BACK}/llm/primary/ping` },
  { name: 'chat POST (edge)', url: `${EDGE}${direct?'/chat':'/api/chat'}` },
  { name: 'chat stream (edge)', url: `${EDGE}${direct?'/chat/stream':'/api/chat/stream'}` }
];

const timeoutMs = Number(process.env.PROBE_TIMEOUT_MS || 4000);

function doReq(t) {
  return new Promise(res => {
    const u = new URL(t.url);
    const isChat = /chat(\/stream)?$/.test(u.pathname);
    const body = isChat ? JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }) : undefined;
    const req = http.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''),
      method: isChat ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {},
      timeout: timeoutMs
    }, resp => {
      let buf = '';
      resp.on('data', d => { if (buf.length < 200) buf += d.toString(); if (buf.length > 200) buf = buf.slice(0,200); });
      resp.on('end', () => res({ name: t.name, status: resp.statusCode, sample: buf.replace(/\s+/g,' ').slice(0,120) }));
    });
    req.on('timeout', () => {
      req.destroy();
      res({ name: t.name, status: 'TIMEOUT', sample: '' });
    });
    req.on('error', e => res({ name: t.name, status: 'ERR', sample: e.message }));
    if (body) req.write(body);
    req.end();
  });
}

const NAME_WIDTH = 24;
(async () => {
  const out = [];
  for (const t of targets) out.push(await doReq(t));
  const pad = (s, n) => String(s).padEnd(n);
  const header = `${pad('endpoint', NAME_WIDTH)} | ${pad('status', 8)} | sample`;
  const rows = out.map(r => `${pad(r.name, NAME_WIDTH)} | ${pad(r.status, 8)} | ${r.sample}`);
  console.log(header + '\n' + rows.join('\n'));
})();
