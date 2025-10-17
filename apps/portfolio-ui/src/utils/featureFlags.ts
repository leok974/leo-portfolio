/**
 * Feature flags with URL override support for testing
 */

export function layoutEnabled(): boolean {
  // Allow URL override for testing: ?layout=1 or ?layout=0
  const u = new URL(window.location.href);
  const q = u.searchParams.get('layout');
  if (q === '1') return true;
  if (q === '0') return false;

  // Default: check build-time env
  return import.meta.env.VITE_LAYOUT_ENABLED === '1';
}
