// tests/coverage-gate.fail.spec.mjs - ensures gate fails for low coverage JSON
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

describe('coverage gate negative case', () => {
  it('fails when coverage below thresholds', () => {
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
    const stderr = res.stderr.toString();
    expect(res.status, 'gate should exit 1 for low coverage').toBe(1);
    expect(stderr).toMatch(/coverage failed/i);
  });
});
