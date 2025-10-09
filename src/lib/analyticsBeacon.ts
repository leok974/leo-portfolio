/**
 * Analytics beacon utilities with E2E test support
 */

/**
 * Send analytics beacon using native sendBeacon API or fetch fallback
 */
export function sendAnalyticsBeacon(url: string, payload: any): boolean | Promise<Response> {
  // Native beacon if available
  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    try {
      return (navigator as any).sendBeacon(
        url,
        new Blob([JSON.stringify(payload)], { type: 'application/json' })
      );
    } catch {
      /* fall through to fetch */
    }
  }

  // Fallback to fetch with keepalive
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  });
}

/**
 * Send beacon with E2E test mode support
 * In E2E mode, simulates success immediately without network call
 */
export function sendBeaconSafe(url: string, payload: any): boolean | Promise<Response> {
  // In E2E mode, short-circuit to avoid network delays
  if (import.meta.env?.VITE_E2E === '1') {
    console.debug('[E2E] analytics beacon suppressed → OK', { url, type: payload?.type });
    return true;
  }

  return sendAnalyticsBeacon(url, payload);
}
