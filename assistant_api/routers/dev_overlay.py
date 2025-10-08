"""Dev overlay router for enabling/disabling admin UI via cookie."""
from fastapi import APIRouter, Response, Request

router = APIRouter(prefix="/agent/dev")

COOKIE_NAME = "sa_dev"


@router.get("/status")
def get_status(request: Request):
    """Check if dev overlay is enabled for this session."""
    enabled = request.cookies.get(COOKIE_NAME) == "1"
    return {"enabled": enabled}


@router.post("/enable")
def enable_overlay(response: Response):
    """Enable dev overlay by setting cookie."""
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
