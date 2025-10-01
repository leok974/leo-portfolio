import { describe, it, expect } from 'vitest';

// Basic heuristic: importing scripts should not add enumerable globals
// (Allows environment-provided additions like performance marks or timers.)

describe('scripts import safety', () => {
  it('imports without leaking globals', async () => {
    const before = Object.keys(globalThis).sort();
    await import('../generate-projects.js');
    await import('../optimize-media.js');
    await import('../validate-schema.js');
    const after = Object.keys(globalThis).sort();
    expect(after).toEqual(before);
  });
});
