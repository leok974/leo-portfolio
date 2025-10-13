/**
 * Admin gate: role-aware + dev override
 *
 * Layered approach:
 * 1) DEV override: ?admin=1 → persists in localStorage (only in dev)
 * 2) ROLE check: /api/auth/me must include role: 'admin' or is_admin: true
 * 3) Feature flag: import.meta.env.VITE_ALLOW_DEV_ADMIN controls dev override
 *
 * Security: Dev override disabled in production via env flag.
 * All admin actions must call protected server endpoints.
 */

export interface AuthInfo {
  user?: {
    id?: string;
    email?: string;
    roles?: string[];
    is_admin?: boolean;
  };
}

const LS_KEY = 'admin:enabled';

/**
 * Capture ?admin=1 from URL and persist in localStorage
 * Call once at app boot
 */
export function initAdminFromQuery() {
  const u = new URL(location.href);
  if (u.searchParams.has('admin')) {
    const v = u.searchParams.get('admin');
    const on = v === '' || v === '1' || v?.toLowerCase() === 'true';
    localStorage.setItem(LS_KEY, on ? '1' : '0');

    // Clean URL if admin was enabled (remove ?admin=1)
    if (on) {
      history.replaceState(null, '', u.pathname + u.hash);
    }
  }
}

/**
 * Check if dev admin override is active
 * Only works when VITE_ALLOW_DEV_ADMIN=1 (dev mode)
 */
export function devAdminEnabled(): boolean {
  const flag = localStorage.getItem(LS_KEY) === '1';
  const allow = (import.meta as any).env?.VITE_ALLOW_DEV_ADMIN === '1';
  return allow && flag;
}

/**
 * Fetch current auth info from backend
 * Returns null if not authenticated or endpoint unavailable
 */
export async function fetchAuth(): Promise<AuthInfo | null> {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include' });
    if (!r.ok) return null;
    return (await r.json()) as AuthInfo;
  } catch {
    return null;
  }
}

/**
 * Check if user has admin role
 */
export function hasAdminRole(info: AuthInfo | null): boolean {
  const r = info?.user?.roles || [];
  return info?.user?.is_admin === true || r.includes('admin') || r.includes('owner');
}

// 10s cache to reduce auth checks
let _cache: { at: number; val: boolean } | null = null;

/**
 * Final admin decision with 10s cache
 * Returns true if either:
 * - Dev override enabled (dev mode only)
 * - User has admin role (prod or dev)
 */
export async function isAdmin(): Promise<boolean> {
  // Local dev override (only works in dev with VITE_ALLOW_DEV_ADMIN=1)
  if (devAdminEnabled()) return true;

  // Check 10s cache
  const now = Date.now();
  if (_cache && now - _cache.at < 10_000) return _cache.val;

  // Real auth check (works in dev and prod)
  const info = await fetchAuth();
  const val = hasAdminRole(info);
  _cache = { at: now, val };
  return val;
}
