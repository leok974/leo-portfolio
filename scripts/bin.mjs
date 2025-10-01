// scripts/bin.mjs - unified CLI dispatcher
import { isEntrypoint } from './_esm-utils.mjs';

const registry = {
  'generate-projects': async () => (await import('../generate-projects.js')).main?.(),
  'optimize-media': async () => (await import('../optimize-media.js')).main?.(),
  'validate-schema': async () => (await import('../validate-schema.js')).main?.()
};

export function help(){
  console.log(`Usage: node scripts/bin.mjs <command>\n\nCommands:\n  generate-projects    Build project pages/artifacts\n  optimize-media       Optimize/transform media assets\n  validate-schema      Validate project JSON schema\n\nExamples:\n  node scripts/bin.mjs generate-projects\n  node scripts/bin.mjs optimize-media --dry-run\n`);
}

export async function run(cmd, ...args){
  if (!cmd || cmd === '--help' || cmd === '-h') return help();
  const fn = registry[cmd];
  if (!fn){
    console.error(`Unknown command: ${cmd}`);
    console.error('Available:', Object.keys(registry).join(', '));
    process.exit(2);
  }
  return fn(...args);
}

if (isEntrypoint(import.meta.url)) {
  const [, , cmd, ...rest] = process.argv;
  await run(cmd, ...rest);
}
