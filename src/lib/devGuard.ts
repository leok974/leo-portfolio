/**
 * Dev guard: Check if privileged/admin UI should be enabled.
 * Returns true if sa_dev cookie is set to "1" or if /agent/dev/status returns enabled.
 */
export async function isPrivilegedUIEnabled(): Promise<boolean> {
  // Check cookie first (fast path)
  if (typeof document !== "undefined") {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "sa_dev" && value === "1") {
        return true;
      }
    }
  }

  // Check API endpoint (fallback)
  try {
    const res = await fetch("/agent/dev/status");
    if (!res.ok) return false;
    const data = await res.json();
    return data.enabled === true;
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
