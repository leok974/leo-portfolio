// Cleanup of legacy inline logic that removed preload markers / spinners.
export function performCleanup(){
  const stale = document.querySelectorAll('[data-remove-after-load]');
  stale.forEach(n=> n.parentElement?.removeChild(n));
}
