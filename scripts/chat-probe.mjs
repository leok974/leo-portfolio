#!/usr/bin/env node
import http from 'http';
import https from 'https';
import { URL } from 'node:url';

const BASE = process.env.BASE || 'http://localhost:8080';
const url = new URL('/chat/stream', BASE);

const payload = JSON.stringify({
  messages: [{ role: 'user', content: 'Stream a short hello with _served_by.' }],
});

const isHttps = url.protocol === 'https:';
const client = isHttps ? https : http;

const req = client.request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload).toString(),
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  }
}, (res) => {
  if (res.statusCode !== 200) {
    console.error(`HTTP ${res.statusCode}`);
  }
  res.setEncoding('utf8');
  let seen = 0;
  res.on('data', (chunk) => {
    process.stdout.write(chunk);
    seen += chunk.length;
    if (seen > 2000) {
      process.stdout.write('\n[truncated after initial 2000 bytes]\n');
      req.destroy();
    }
  });
  res.on('end', () => process.stdout.write('\n[stream end]\n'));
});

req.on('error', (err) => console.error('Request error:', err));
req.write(payload);
req.end();
