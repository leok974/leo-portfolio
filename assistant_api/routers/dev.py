"""
Dev Overlay API Routes

Provides endpoints for dev overlay status checking and layout stubs.
These endpoints enable the frontend dev overlay to work even when the full backend is unavailable.
"""

import os
from datetime import datetime, timezone
from fastapi import APIRouter, Header

router = APIRouter()  # No prefix here - will be added in main.py

# Environment variable for dev overlay authentication
DEV_OVERLAY_KEY = os.getenv("DEV_OVERLAY_KEY", "")


def _now_iso():
    """Return current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).isoformat()


@router.get("/dev/status")
def dev_status(x_dev_key: str | None = Header(default=None)):
    """
    Check if dev overlay is allowed for the current request.

    Returns:
        - ok: true (for compatibility)
        - allowed: true if the x-dev-key header matches DEV_OVERLAY_KEY
        - mode: "token" if authenticated, "denied" otherwise
        - source: authentication source
        - ts: current timestamp
    """
    if DEV_OVERLAY_KEY and x_dev_key == DEV_OVERLAY_KEY:
        return {
            "ok": True,
            "allowed": True,
            "mode": "token",
            "source": "dev_overlay_key",
            "ts": _now_iso()
        }

    return {
        "ok": True,
        "allowed": False,
        "mode": "denied",
        "source": "none",
        "ts": _now_iso()
    }


@router.get("/layout")
def layout_stub():
    """
    Stub endpoint for layout configuration.
    Returns empty weights until full layout system is implemented.

    This prevents 404 errors when the frontend dev overlay tries to fetch layout.
    """
    return {
        "weights": {},
        "updated_at": None
    }
