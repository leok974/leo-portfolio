// scripts/bin.mjs - unified CLI dispatcher
import { isEntrypoint } from './_esm-utils.mjs';

const registry = {
  'generate-projects': async () => (await import('../generate-projects.js')).main?.(),
  'optimize-media': async () => (await import('../optimize-media.js')).main?.(),
  'validate-schema': async () => (await import('../validate-schema.js')).main?.()
};

export async function run(cmd, ...args){
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
