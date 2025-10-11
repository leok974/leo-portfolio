/**
 * Admin Headers Helper
 *
 * Builds HTTP headers for admin-only API endpoints.
 *
 * Reads from:
 * 1. window.__ADMIN_EMAIL__ / window.__ADMIN_ROLE__ (runtime injection)
 * 2. VITE_ADMIN_EMAIL / VITE_ADMIN_ROLE (build-time env vars)
 *
 * Returns headers for RBAC authentication:
 * - X-User-Role: "admin"
 * - X-User-Email: "leoklemet.pa@gmail.com"
 *
 * These headers are validated by assistant_api/rbac.py require_admin()
 * which checks against ADMIN_USERS environment variable on the server.
 *
 * No secrets are exposed here - the server enforces authorization.
 */

export function adminHeaders(): HeadersInit {
  const email = (window as any).__ADMIN_EMAIL__ || import.meta.env.VITE_ADMIN_EMAIL || "";
  const role = (window as any).__ADMIN_ROLE__ || import.meta.env.VITE_ADMIN_ROLE || "admin";

  const headers: Record<string, string> = {};

  if (role) {
    headers["X-User-Role"] = String(role);
  }

  if (email) {
    headers["X-User-Email"] = String(email);
  }

  return headers;
}
