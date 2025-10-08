/**
 * Dev guard: Check if privileged/admin UI should be enabled.
 * Returns true if sa_dev cookie exists and validates.
 * Accepts either 'enabled' or 'allowed' from API (boolean or "1" for resilience).
 */
export async function isPrivilegedUIEnabled(): Promise<boolean> {
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
