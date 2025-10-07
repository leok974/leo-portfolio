"""
Feature flag utilities for gating experimental features.

Usage:
    from assistant_api.utils.features import require_uploads_enabled

    @router.post('/upload')
    async def upload(user = Depends(require_uploads_enabled)):
        # upload logic
"""

import os
from fastapi import Depends, HTTPException, Request
from .auth import get_current_user


def is_dev() -> bool:
    """Check if running in development mode."""
    return os.getenv("ALLOW_TOOLS", "0") == "1" or os.getenv("ENV", "").lower() in ("dev", "development", "local")


def uploads_enabled_env() -> bool:
    """Check if uploads feature is enabled via environment variable."""
    # Explicit feature flag OR dev mode
    return os.getenv("FEATURE_UPLOADS", "0") == "1" or is_dev()


async def require_uploads_enabled(request: Request):
    """
    Dependency to gate upload endpoints.

    Allows access if:
    - User is admin (via ALLOW_TOOLS=1 or X-Admin-Token header)
    - Feature flag FEATURE_UPLOADS=1 is set
    - Running in dev mode (ALLOW_TOOLS=1 or ENV=dev)

    Raises:
        HTTPException: 403 if uploads are disabled and user is not admin
    """
    user = get_current_user(request)

    # Always allow admins
    if user and user.get("role") == "admin":
        return True

    # Otherwise require dev or explicit flag
    if uploads_enabled_env():
        return True

    raise HTTPException(
        status_code=403,
        detail="Uploads are disabled. Set FEATURE_UPLOADS=1 or contact admin."
    )
