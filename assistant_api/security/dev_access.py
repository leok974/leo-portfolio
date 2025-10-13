"""
Dev access security for privileged metrics dashboard.
Supports multiple authentication methods with optional localhost bypass.
"""

import ipaddress

from fastapi import HTTPException, Request


def _client_ip(req: Request) -> str | None:
    """Extract client IP from X-Forwarded-For or request.client."""
    xff = req.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return req.client.host if req.client else None


def ensure_dev_access(req: Request, settings: dict):
    """
    Enforce dev/privileged access to metrics dashboard.

    Allows access if:
    1. Localhost AND METRICS_ALLOW_LOCALHOST=true (dev convenience)
    2. Valid METRICS_DEV_TOKEN provided via:
       - Authorization: Bearer <token>
       - X-Dev-Token: <token>
       - ?dev=<token>
       - Cookie: dev_token=<token>

    Raises HTTPException 403 if unauthorized.
    """
    # 1) Allow localhost in dev if enabled
    ip = _client_ip(req)
    if settings.get("METRICS_ALLOW_LOCALHOST") and ip:
        try:
            if ipaddress.ip_address(ip).is_loopback:
                return
        except Exception:
            pass

    # 2) Require token otherwise
    expected = settings.get("METRICS_DEV_TOKEN")
    if not expected:
        # Server not configured; treat as forbidden but with explicit reason.
        raise HTTPException(status_code=403, detail="metrics_dev_token_not_set")

    # Try to read a provided token
    provided = None
    auth = req.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        provided = auth.split(" ", 1)[1].strip()
    provided = provided or req.headers.get("x-dev-token")
    provided = provided or req.query_params.get("dev")
    provided = provided or req.cookies.get("dev_token")

    if not provided:
        # No credentials presented
        raise HTTPException(status_code=401, detail="dev_token_required")
    if provided != expected:
        # Wrong credentials
        raise HTTPException(status_code=403, detail="dev_token_invalid")
    return
