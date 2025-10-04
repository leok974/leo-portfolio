#!/usr/bin/env node
import http from 'node:http';

const url = process.env.WARM_SSE_URL || 'http://127.0.0.1:8080/api/chat/stream';
const payload = JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] });
let chunks = 0;

const req = http.request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, res => {
  res.on('data', data => {
    chunks++;
    if (chunks <= 2) process.stdout.write(data);
    if (chunks >= 2) {
      console.log('\n[ warm-sse ] closing after 2 chunks');
      res.destroy();
      req.destroy();
    }
  });
  res.on('error', e => console.warn('[ warm-sse ] resp error', e.message));
  res.on('end', () => console.log('[ warm-sse ] stream ended'));
});
req.on('error', e => console.warn('[ warm-sse ]', e.message));
req.end(payload);
