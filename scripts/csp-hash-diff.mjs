// Diff helper for CSP inline script hash vs nginx.test.conf
import fs from 'node:fs';

const HASH_FILE = '.github/csp/inline-script-hashes.json';
const NGINX_FILE = 'nginx.test.conf';

function safeRead(p){
  try { return fs.readFileSync(p,'utf8'); } catch { return ''; }
}

const json = safeRead(HASH_FILE);
const extracted = (json.match(/sha256-[A-Za-z0-9+/=]+/g)||[])[0] || '';
const conf = safeRead(NGINX_FILE);
const inConf = (conf.match(/'sha256-[A-Za-z0-9+/=]+'/)||[''])[0].replace(/'/g,'');

console.log(`[csp-guard] extracted: ${extracted||'(none)'}`);
console.log(`[csp-guard] in nginx : ${inConf||'(none)'}`);

if(!extracted){
  console.warn('[csp-guard] no extracted hash found; skipping drift enforcement');
  process.exit(0);
}
if(extracted !== inConf){
  console.error('[csp-guard] DRIFT: hashes differ');
  process.exit(1);
}
console.log('[csp-guard] OK: hashes match');
