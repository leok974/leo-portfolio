import { describe, it, expect } from 'vitest';
import { computeVisibility, announcementText } from '../src/filters';

describe('filters helpers', () => {
  it('computes visibility for all', () => {
    expect(computeVisibility('agents ml', 'all')).toBe(true);
  });
  it('computes visibility when category present', () => {
    expect(computeVisibility('agents ml', 'ml')).toBe(true);
  });
  it('computes visibility false when absent', () => {
    expect(computeVisibility('agents ml', 'devops')).toBe(false);
  });
  it('announcement text formats correctly', () => {
    expect(announcementText('all')).toContain('all');
    expect(announcementText('ml')).toContain('ml');
  });
});
