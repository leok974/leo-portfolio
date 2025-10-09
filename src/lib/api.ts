/**
 * API utility functions for consistent backend communication.
 * Ensures API calls go to correct backend, not Vite SPA fallback.
 */

const DEFAULT_PREFIX = '/api';

/**
 * API base URL - either from window override, env var, or default prefix.
 * This ensures API calls don't hit Vite's SPA fallback (which returns index.html).
 */
export const API_BASE =
  (window as any).__API_BASE__ ||
  import.meta.env?.VITE_BACKEND_BASE ||
  DEFAULT_PREFIX;

/**
 * Make an API request with proper base URL and headers.
 * Use this instead of raw fetch() for API endpoints.
 *
 * @example
 * const res = await api('/analytics/latest');
 * const data = await res.json();
 */
export async function api(path: string, init?: RequestInit): Promise<Response> {
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  return res;
}

/**
 * Make an API GET request and parse JSON response.
 * Throws on non-2xx status or JSON parse errors.
 */
export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await api(path);
  if (!res.ok) {
    throw new Error(`API GET ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Make an API POST request with JSON body.
 * Throws on non-2xx status.
 */
export async function apiPost<T = any>(path: string, body: any): Promise<T> {
  const res = await api(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API POST ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
