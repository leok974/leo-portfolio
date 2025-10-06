/**
 * waitUntil - Generic polling utility for async predicates
 *
 * Repeatedly calls `fn` until `pred(result)` returns true or timeout expires.
 * Useful for waiting on DOM state, API responses, or any condition that needs polling.
 *
 * @example
 * // Wait for element to become visible
 * await waitUntil(
 *   () => page.locator('#tooltip').isVisible(),
 *   (visible) => visible === true,
 *   2000
 * );
 *
 * @example
 * // Wait for API to return specific data
 * await waitUntil(
 *   async () => {
 *     const res = await fetch('/api/status');
 *     return res.json();
 *   },
 *   (data) => data.ready === true,
 *   5000
 * );
 */
export async function waitUntil<T>(
  fn: () => Promise<T> | T,
  pred: (_v: T) => boolean,
  ms = 2000,
  step = 50,
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const v = await fn();
    if (pred(v)) return v;
    await new Promise(r => setTimeout(r, step));
  }
  throw new Error(`waitUntil timed out after ${ms}ms`);
}

/**
 * waitForCondition - Simplified version that just checks a boolean condition
 *
 * @example
 * await waitForCondition(
 *   () => page.locator('.modal').isVisible(),
 *   3000
 * );
 */
export async function waitForCondition(
  fn: () => Promise<boolean> | boolean,
  ms = 2000,
  step = 50,
): Promise<void> {
  await waitUntil(fn, (v) => v === true, ms, step);
}
