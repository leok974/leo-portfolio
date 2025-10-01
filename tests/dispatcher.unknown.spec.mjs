import { spawn } from 'node:child_process';
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const bin = resolve(__dirname, '../scripts/bin.mjs');

const child = spawn(process.execPath, [bin, 'definitely-not-a-cmd'], { stdio: ['ignore','ignore','pipe'] });

let stderr = '';
child.stderr.on('data', d => { stderr += String(d); });

child.on('close', (code) => {
  try {
    assert.equal(code, 2, 'unknown command should exit with code 2');
    assert.match(stderr, /Unknown command/i);
    console.log('dispatcher unknown command test: ok');
    process.exit(0);
  } catch (e) {
    console.error('stderr:', stderr);
    console.error(e.message);
    process.exit(1);
  }
});
