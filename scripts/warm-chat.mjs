#!/usr/bin/env node
import http from 'node:http';

const URL = process.env.WARM_URL || 'http://127.0.0.1:8080/api/chat';
const body = JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] });
const timeoutMs = Number(process.env.WARM_TIMEOUT_MS || 5000);

const req = http.request(URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  },
  timeout: timeoutMs
}, res => {
  res.on('error', () => { /* swallow stream errors */ });
  res.resume();
  console.log(`[warm-chat] ${res.statusCode} ${res.headers['content-type'] || ''}`);
});
req.on('timeout', () => {
  console.warn('[warm-chat] timeout');
  req.destroy();
});
req.on('error', e => console.warn('[warm-chat] ERR', e.message));
req.end(body);
