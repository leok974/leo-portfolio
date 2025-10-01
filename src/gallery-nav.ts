// gallery-nav.ts - pure function for computing next gallery index

export type NavKey = 'ArrowRight' | 'ArrowLeft' | 'Home' | 'End';

export function computeGalleryIndex(current: number, key: NavKey, length: number): number {
  if (length <= 0) return 0;
  switch (key) {
    case 'ArrowRight': return (current + 1) % length;
    case 'ArrowLeft': return (current - 1 + length) % length;
    case 'Home': return 0;
    case 'End': return length - 1;
    default: return current;
  }
}
