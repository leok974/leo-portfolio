"""Dev overlay router for enabling/disabling admin UI via cookie."""
import os

from fastapi import APIRouter, HTTPException, Request, Response, status

router = APIRouter(prefix="/agent/dev")

COOKIE_NAME = "sa_dev"


@router.get("/status")
def get_status(request: Request):
    """Check if dev overlay is enabled for this session."""
    enabled = request.cookies.get(COOKIE_NAME) == "1"
    return {"enabled": enabled}


@router.post("/enable")
def enable_overlay(response: Response):
    """
    Enable dev overlay by setting cookie.

    Production safety: In production environments, this endpoint should be
    protected by Cloudflare Access or similar authentication middleware.
    If APP_ENV=prod and no authentication is configured, this will return 403.
    """
    # Production safety check - disable in prod unless explicitly allowed
    app_env = os.getenv("APP_ENV", "dev").lower()
    allow_dev_in_prod = os.getenv("ALLOW_DEV_OVERLAY_IN_PROD", "0") == "1"

    if app_env == "prod" and not allow_dev_in_prod:
        # In production, dev overlay should be gated by Cloudflare Access or similar
        # This prevents unauthorized access to admin features
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev overlay disabled in production. Use Cloudflare Access or set ALLOW_DEV_OVERLAY_IN_PROD=1"
        )

    response.set_cookie(
        COOKIE_NAME,
        "1",
        httponly=False,
        samesite="lax",
        path="/",
        max_age=86400 * 30,  # 30 days
    )
    return {"ok": True, "enabled": True}


@router.post("/disable")
def disable_overlay(response: Response):
    """Disable dev overlay by removing cookie."""
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True, "enabled": False}
