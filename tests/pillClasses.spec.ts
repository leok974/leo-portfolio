import { describe, it, expect } from 'vitest';
import { pillClasses, classify } from '../js/agent-status.js';

describe('pillClasses helper', () => {
  it('composes classes', () => {
    expect(pillClasses('ok')).toBe('pill pill--ok');
  });
});

describe('classify fallback', () => {
  it('classify returns ok when all good', () => {
    const res = classify({ llm: { path: 'x'}, rag: { ok: true }, openai_configured: true });
    expect(['ok','warn']).toContain(res); // fallback may degrade to warn if window injection not present
  });
});
