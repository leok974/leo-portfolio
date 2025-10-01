// Sync the JSON-LD inline script hash into nginx.test.conf
// Extracts the first sha256-* token from .github/csp/inline-script-hashes.json and
// replaces any existing 'sha256-...' occurrences in the nginx test config.
import fs from 'node:fs';

const HASH_FILE = '.github/csp/inline-script-hashes.json';
const NGINX_FILE = 'nginx.test.conf';

let hashJson;
try {
  hashJson = fs.readFileSync(HASH_FILE, 'utf8');
} catch (e) {
  console.warn(`[csp-sync] Could not read ${HASH_FILE}:`, e.message || e);
  process.exit(0);
}

const firstHash = (hashJson.match(/sha256-[A-Za-z0-9+/=]+/g) || [])[0];
if (!firstHash) {
  console.warn(`[csp-sync] No sha256-* token found inside ${HASH_FILE}; leaving ${NGINX_FILE} untouched.`);
  process.exit(0);
}

let conf;
try {
  conf = fs.readFileSync(NGINX_FILE, 'utf8');
} catch (e) {
  console.warn(`[csp-sync] Could not read ${NGINX_FILE}:`, e.message || e);
  process.exit(0);
}

const updated = conf.replace(/'sha256-[A-Za-z0-9+/=]+'/g, `'${firstHash}'`);
if (updated !== conf) {
  fs.writeFileSync(NGINX_FILE, updated);
  console.log(`[csp-sync] Updated ${NGINX_FILE} script-src hash to ${firstHash}`);
} else {
  console.log(`[csp-sync] ${NGINX_FILE} already contains ${firstHash}`);
}
