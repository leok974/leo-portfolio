// scripts/_esm-utils.mjs
// Robust helper(s) for ESM Node scripts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * True when this module file is the direct Node entry (not just imported).
 * - Follows symlinks (fs.realpathSync)
 * - Normalizes path separators for Windows
 * - Returns false for `node -e`, `node -p`, REPL (no argv[1])
 * @param {string} metaUrl import.meta.url from caller
 */
/**
 * @param {string} metaUrl
 * @returns {boolean}
 */
export function isEntrypoint(metaUrl){
  if (!process.argv[1]) return false;
  try {
    const invoked = fs.realpathSync(process.argv[1]);
    const current = fs.realpathSync(fileURLToPath(metaUrl));
  /** @type {(p:string)=>string} */
  const norm = p => path.normalize(p);
    return norm(invoked) === norm(current);
  } catch {
    return false;
  }
}
