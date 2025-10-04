#!/usr/bin/env node
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const target = process.argv[2] || 'http://127.0.0.1:8080/_up';
const url = new URL(target);
const timeout = Number((process.argv.find(a => a.startsWith('--timeout=')) || '').split('=')[1] || 120000);
const interval = Number((process.argv.find(a => a.startsWith('--interval=')) || '').split('=')[1] || 1000);
const client = url.protocol === 'https:' ? https : http;
const start = Date.now();

function tryOnce() {
  return new Promise(resolve => {
    const req = client.get(url, { timeout: Math.min(2000, interval * 2) }, res => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

(async () => {
  while (Date.now() - start < timeout) {
    if (await tryOnce()) {
      console.log(`[wait-http] OK: ${url.href}`);
      process.exit(0);
    }
  await new Promise(r => globalThis.setTimeout(r, interval));
  }
  console.error(`[wait-http] TIMEOUT after ${timeout}ms: ${url.href}`);
  process.exit(1);
})();
