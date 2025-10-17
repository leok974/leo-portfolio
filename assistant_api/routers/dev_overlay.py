"""Dev overlay router for enabling/disabling admin UI via cookie."""

import os
import hmac
import hashlib
import time

from fastapi import APIRouter, HTTPException, Request, Response, status

router = APIRouter(prefix="/agent/dev", tags=["dev"])

COOKIE_NAME = "sa_dev"
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "1") == "1"
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN", "")
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").capitalize()  # "Lax" | "Strict" | "None"
COOKIE_MAX_AGE = 60 * 60 * 24 * 14  # 14 days

DEV_ENABLE_TOKEN = os.getenv("SITEAGENT_DEV_ENABLE_TOKEN", "dev")  # use a secret in prod
SIGNING_KEY = os.getenv("SITEAGENT_DEV_COOKIE_KEY", "")            # optional HMAC signing


def _sign(val: str) -> str:
    """Sign a value with HMAC-SHA256 if SIGNING_KEY is configured."""
    if not SIGNING_KEY:
        return ""
    mac = hmac.new(SIGNING_KEY.encode("utf-8"), val.encode("utf-8"), hashlib.sha256).hexdigest()
    return mac


def _make_cookie_value(enabled: bool) -> str:
    """Create a signed cookie value with timestamp."""
    ts = str(int(time.time()))
    val = f"{'1' if enabled else '0'}.{ts}"
    sig = _sign(val)
    return f"{val}.{sig}" if sig else ("1" if enabled else "0")


def _verify_cookie(raw: str) -> bool:
    """Verify a signed cookie value."""
    if not raw:
        return False
    if not SIGNING_KEY:
        return raw == "1"
    try:
        val, sig = raw.rsplit(".", 1)
    except ValueError:
        return False
    return hmac.compare_digest(_sign(val), sig) and val.split(".", 1)[0] == "1"


def _set_cookie(resp: Response, value: str):
    """Set the dev overlay cookie with configured domain/secure settings."""
    resp.set_cookie(
        key=COOKIE_NAME,
        value=value,
        max_age=COOKIE_MAX_AGE,
        domain=COOKIE_DOMAIN or None,
        secure=COOKIE_SECURE,
        httponly=False,           # overlay runs in the browser
        samesite=COOKIE_SAMESITE, # Lax is good for same-site nav
        path="/",
    )


def _del_cookie(resp: Response):
    """Delete the dev overlay cookie."""
    resp.delete_cookie(
        key=COOKIE_NAME,
        domain=COOKIE_DOMAIN or None,
        path="/",
    )


@router.get("/status")
def get_status(request: Request):
    """Check if dev overlay is enabled for this session."""
    raw = request.cookies.get(COOKIE_NAME, "")
    enabled = _verify_cookie(raw)
    return {"enabled": enabled, "cookie_present": bool(raw)}


@router.get("/enable")
def enable_overlay(request: Request, response: Response):
    """
    Enable dev overlay by setting cookie.

    Requires Authorization: Bearer <token> header.
    Production safety: Token should be set via SITEAGENT_DEV_ENABLE_TOKEN env var.
    """
    # Check authorization header
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = auth.split(" ", 1)[1]
    if token != DEV_ENABLE_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid token")

    # Set signed cookie
    cookie_val = _make_cookie_value(True)
    _set_cookie(response, cookie_val)
    return {"ok": True, "enabled": True}


@router.get("/disable")
def disable_overlay(response: Response):
    """Disable dev overlay by removing cookie."""
    _del_cookie(response)
    return {"ok": True, "enabled": False}
