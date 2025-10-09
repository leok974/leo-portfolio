/**
 * Dev guard: Check if privileged/admin UI should be enabled.
 * Returns true if sa_dev cookie exists and validates.
 * Accepts either 'enabled' or 'allowed' from API (boolean or "1" for resilience).
 *
 * E2E Mode: Always returns true to enable all privileged UI in tests.
 */
export async function isPrivilegedUIEnabled(): Promise<boolean> {
  // E2E mode: always enable privileged UI
  if (import.meta.env?.VITE_E2E === '1') {
    console.debug('[E2E] isPrivilegedUIEnabled() → true (forced)');
    return true;
  }

  try {
    const res = await fetch("/agent/dev/status", { cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json();

    // Accept either 'enabled' or 'allowed' key (future-proof)
    const val = data?.enabled ?? data?.allowed;
    return val === true || val === "1";
  } catch {
    return false;
  }
}

/**
 * Enable dev overlay by calling /agent/dev/enable.
 * Sets sa_dev=1 cookie for 30 days.
 */
export async function enableDevOverlay(): Promise<boolean> {
  try {
    const res = await fetch("/agent/dev/enable", { method: "POST" });
    if (!res.ok) return false;
    const data = await res.json();
    return data.enabled === true;
  } catch {
    return false;
  }
}

/**
 * Disable dev overlay by calling /agent/dev/disable.
 * Removes sa_dev cookie.
 */
export async function disableDevOverlay(): Promise<boolean> {
  try {
    const res = await fetch("/agent/dev/disable", { method: "POST" });
    if (!res.ok) return false;
    const data = await res.json();
    return data.enabled === false;
  } catch {
    return false;
  }
}

// --- Phase 50.8: Lightweight localStorage-based dev flag ---

import { sendEvent, getVisitorId } from "./metrics";

export const DEV_FLAG_KEY = "dev_unlocked";

/**
 * Check if dev UI should be enabled (localStorage-based).
 * Synchronous alternative to the async cookie-based check above.
 */
export function isDevUIEnabled(): boolean {
  return localStorage.getItem(DEV_FLAG_KEY) === "1";
}

/**
 * Enable dev UI (sets localStorage flag).
 * Tracks the toggle event for audit purposes.
 */
export function enableDevUI(): void {
  localStorage.setItem(DEV_FLAG_KEY, "1");
  void sendEvent({ visitor_id: getVisitorId(), event: "dev_mode_enabled", metadata: {} });
}

/**
 * Disable dev UI (removes localStorage flag).
 * Tracks the toggle event for audit purposes.
 */
export function disableDevUI(): void {
  localStorage.removeItem(DEV_FLAG_KEY);
  void sendEvent({ visitor_id: getVisitorId(), event: "dev_mode_disabled", metadata: {} });
}

/**
 * Sync dev flag from query string (?dev=1 or ?dev=0).
 * Call once at app boot to react to query parameters.
 */
export function syncDevFlagFromQuery(search = location.search): void {
  const q = new URLSearchParams(search);
  if (q.has("dev")) {
    const v = q.get("dev");
    if (v === "1" || v === "true") enableDevUI();
    if (v === "0" || v === "false") disableDevUI();
  }
}
