#!/usr/bin/env node
// scripts/ci-smoke.mjs - minimal CI smoke: dispatcher help + dynamic imports
import { execSync } from 'node:child_process';

function sh(cmd){
  execSync(cmd, { stdio: 'inherit', env: process.env });
}

console.log('[ci-smoke] dispatcher --help');
sh('node scripts/bin.mjs --help');

console.log('[ci-smoke] dynamic imports');
await import('../generate-projects.js');
await import('../optimize-media.js');
await import('../validate-schema.js');

console.log('[ci-smoke] OK');