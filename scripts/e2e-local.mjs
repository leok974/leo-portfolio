#!/usr/bin/env node
import { execSync } from 'node:child_process';

const compose = 'deploy/docker-compose.yml';
const BASE = process.env.PW_BASE_URL || 'http://localhost:8080';

function sh(cmd) { console.log('$', cmd); execSync(cmd, { stdio: 'inherit' }); }

try {
  sh(`docker compose -f ${compose} up -d --build nginx backend`);
  console.log('⏳ waiting for server at', BASE);
  const started = Date.now();
  while (Date.now() - started < 120000) {
    try {
      execSync(`curl -sf ${BASE}/ready`, { stdio: 'ignore' });
      break;
    } catch { /* retry */ }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  sh(`npx playwright test --reporter=line`);
} finally {
  // keep stack up for inspection if CI is not set
  if (process.env.CI) {
    sh(`docker compose -f ${compose} logs --no-color --timestamps --tail=200 nginx backend || true`);
    sh(`docker compose -f ${compose} down`);
  } else {
    console.log('ℹ️ stack still running (docker compose). Run "docker compose -f deploy/docker-compose.yml down" when done.');
  }
}
