// One-shot strict nginx (static or full-stack) smoke runner.
// Usage:
//   pnpm smoke:strict-nginx          (static only)
//   pnpm smoke:strict-nginx:full     (full-stack with mock backend)
// Optional negative test example (full-stack):
//   FAIL_READY=1 EXPECT_READY_FALSE=1 pnpm smoke:strict-nginx:full
import { execSync } from 'node:child_process';
import http from 'node:http';

const isFull = process.argv.includes('--full');
const compose = isFull ? 'docker-compose.test.full.yml' : 'docker-compose.test.yml';
// Static compose publishes 5178 -> 80, full-stack nginx listens 8080 -> published 8080
const BASE = isFull ? 'http://localhost:8080' : 'http://localhost:5178';

const sh = (cmd, opts = {}) => {
  console.log(' $', cmd);
  execSync(cmd, { stdio: 'inherit', env: { ...process.env }, ...opts });
};

console.log('→ Build dist');
sh('pnpm build:prod');

console.log('→ Sync CSP hashes for test nginx');
// Allow hash extraction to succeed even if no inline scripts (allow-empty)
sh('pnpm csp:hash');
sh('pnpm csp:sync:test');

console.log(`→ docker compose up (${compose})`);
sh(`docker compose -f ${compose} up -d --build`);

console.log('→ Wait for /healthz');
const waitHealth = (url, limit = 90) => new Promise((resolve, reject) => {
  let tries = 0;
  const tick = () => {
    tries++;
    http.get(url, res => {
      if (res.statusCode === 204) return resolve();
      again();
    }).on('error', again);
  };
  const again = () => {
    if (tries >= limit) return reject(new Error('health timeout'));
    setTimeout(tick, 1000);
  };
  tick();
});

await waitHealth(`${BASE}/healthz`).catch(e => {
  console.error('Health check failed:', e.message);
  process.exit(1);
});

console.log('→ Run smoke grep set');
// Intentionally exclude CSP here; security set can be run separately via test:security.
// root html mime + bundle wiring (asset integrity) covered.
const grep = 'stylesheet|status pill|summary|ping|root html mime|bundle wiring';
const baseEnv = {
  BASE,
  NGINX_STRICT: '1',
  REQUIRE_CSS_200: '1',
  REQUIRE_STATUS_PILL_STRICT: '1',
  PLAYWRIGHT_STRICT_STREAM: '1',
  BACKEND_REQUIRED: isFull ? '1' : '0'
};

try {
  sh(`pnpm exec playwright test -g "${grep}"`, { env: { ...process.env, ...baseEnv } });
  // If user injected FAIL_READY + EXPECT_READY_FALSE the negative spec will also run (full-stack only)
  if (isFull && process.env.EXPECT_READY_FALSE === '1') {
    console.log('→ Running negative readiness assertion (@negative)');
    sh(`pnpm exec playwright test -g "@negative"`, { env: { ...process.env, ...baseEnv, EXPECT_READY_FALSE: '1' } });
  }
} finally {
  console.log('→ docker compose down');
  try { sh(`docker compose -f ${compose} down -v`); } catch { /* ignore */ }
}
