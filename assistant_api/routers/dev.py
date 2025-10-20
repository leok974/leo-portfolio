"""
Dev Overlay API Routes

Provides endpoints for dev overlay status checking and layout stubs.
These endpoints enable the frontend dev overlay to work even when the full backend is unavailable.
"""

import os
from fastapi import APIRouter, Header

router = APIRouter(tags=["dev"])

# Environment variable for dev overlay authentication
DEV_OVERLAY_KEY = os.getenv("DEV_OVERLAY_KEY", "")


@router.get("/api/dev/status")
def dev_status(x_dev_key: str | None = Header(default=None)):
    """
    Check if dev overlay is allowed for the current request.

    Returns:
        - allowed: true if the x-dev-key header matches DEV_OVERLAY_KEY
        - mode: "token" if authenticated, "denied" otherwise
    """
    if DEV_OVERLAY_KEY and x_dev_key == DEV_OVERLAY_KEY:
        return {"allowed": True, "mode": "token"}

    return {"allowed": False, "mode": "denied"}


@router.get("/api/layout")
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
