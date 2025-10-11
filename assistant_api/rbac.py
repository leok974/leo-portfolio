"""Role-Based Access Control (RBAC) helper for admin-only operations."""
import os
from fastapi import Header, HTTPException

# Environment variables for admin authentication
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")
ADMIN_USERS = {
    email.strip().lower()
    for email in (os.getenv("ADMIN_USERS", "") or "").split(",")
    if email.strip()
}


def require_admin(
    x_admin_key: str = Header(default="", alias="X-Admin-Key"),
    x_user_role: str = Header(default="", alias="X-User-Role"),
    x_user_email: str = Header(default="", alias="X-User-Email"),
) -> dict[str, str | None]:
    """
    Dependency that enforces admin-only access.

    Supports two authentication modes:
    1. **Admin API Key**: Shared secret key via X-Admin-Key header
       - Set ADMIN_API_KEY environment variable
       - Used for service-to-service or tooling access

    2. **Role-based + Email Allowlist**: X-User-Role and X-User-Email headers
       - X-User-Role must be "admin"
       - Optional: X-User-Email must be in ADMIN_USERS allowlist
       - Typically set by edge proxy (Cloudflare Access, nginx, etc.)

    Args:
        x_admin_key: Shared admin API key (optional)
        x_user_role: User role from auth proxy (optional)
        x_user_email: User email from auth proxy (optional)

    Returns:
        dict with:
            - "by": Authentication method ("key" or "role")
            - "email": User email if available

    Raises:
        HTTPException: 403 Forbidden if admin authentication fails

    Environment Variables:
        ADMIN_API_KEY: Shared secret key for service-to-service auth
        ADMIN_USERS: Comma-separated list of allowed admin emails
                     (e.g., "lead@example.com,ops@example.com")

    Examples:
        # Option A: API key authentication
        curl -H "X-Admin-Key: secret123" http://api/agents/tasks/1/approve

        # Option B: Role-based authentication (via auth proxy)
        curl -H "X-User-Role: admin" -H "X-User-Email: lead@example.com" \\
             http://api/agents/tasks/1/approve
    """
    # Option A: Shared admin key (service-to-service)
    if ADMIN_API_KEY and x_admin_key == ADMIN_API_KEY:
        return {"by": "key", "email": x_user_email or None}

    # Option B: Role header + optional allowlist
    if x_user_role.lower() == "admin":
        # If ADMIN_USERS is not configured, allow any admin role
        # If configured, verify email is in allowlist
        if not ADMIN_USERS or (x_user_email and x_user_email.lower() in ADMIN_USERS):
            return {"by": "role", "email": x_user_email or None}

    # Neither authentication method succeeded
    raise HTTPException(status_code=403, detail="Admin role required")
