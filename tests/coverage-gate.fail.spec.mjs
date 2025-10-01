// tests/coverage-gate.fail.spec.mjs - ensures gate fails for low coverage JSON
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'cov-gate-'));
const fake = join(dir, 'summary.json');
writeFileSync(fake, JSON.stringify({ total: {
  lines: { pct: 10 },
  statements: { pct: 15 },
  functions: { pct: 5 },
  branches: { pct: 2 }
} }), 'utf8');

const res = spawnSync(process.execPath, ['scripts/coverage-gate.mjs'], {
  env: { ...process.env, COV_SUMMARY: fake }, stdio: 'pipe'
});

if (res.status === 1 && /coverage failed/i.test(res.stderr.toString())) {
  console.log('coverage gate failure test: ok');
  process.exit(0);
}
console.error('Expected gate to fail with exit 1. Output:\n', res.stdout.toString(), res.stderr.toString());
process.exit(1);
