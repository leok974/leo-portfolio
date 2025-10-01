import { describe, it, expect } from 'vitest';
import { computeGalleryIndex } from '../src/gallery-nav';

describe('gallery navigation', () => {
  it('wraps forward', () => {
    expect(computeGalleryIndex(2, 'ArrowRight', 3)).toBe(0);
  });
  it('wraps backward', () => {
    expect(computeGalleryIndex(0, 'ArrowLeft', 3)).toBe(2);
  });
  it('home goes to 0', () => {
    expect(computeGalleryIndex(2, 'Home', 5)).toBe(0);
  });
  it('end goes to last', () => {
    expect(computeGalleryIndex(0, 'End', 5)).toBe(4);
  });
});
