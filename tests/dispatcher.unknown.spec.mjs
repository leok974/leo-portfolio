import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const bin = resolve(__dirname, '../scripts/bin.mjs');

describe('scripts dispatcher', () => {
  it('exits with code 2 and message for unknown command', () => {
    const res = spawnSync(process.execPath, [bin, 'definitely-not-a-cmd'], { encoding: 'utf8' });
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/Unknown command/i);
  });
});
