import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse

ADMIN_SECRET = os.environ.get("ADMIN_HMAC_SECRET", "change-me")
ADMIN_EMAILS = [
    e.strip().lower()
    for e in os.environ.get("ADMIN_EMAILS", "leoklemet.pa@gmail.com").split(",")
]
COOKIE_NAME = "admin_auth"
COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days
COOKIE_DOMAIN = os.environ.get("COOKIE_DOMAIN", None)  # e.g. ".ledger-mind.org" in prod


def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (4 - len(s) % 4))


def _sign(obj: dict[str, Any]) -> str:
    body = _b64url(json.dumps(obj, separators=(",", ":")).encode())
    sig = hmac.new(ADMIN_SECRET.encode(), body.encode(), hashlib.sha256).digest()
    return f"{body}.{_b64url(sig)}"


def _verify(token: str) -> dict[str, Any] | None:
    try:
        body, sig = token.split(".", 1)
        want = hmac.new(ADMIN_SECRET.encode(), body.encode(), hashlib.sha256).digest()
        got = _b64url_decode(sig)
        if not hmac.compare_digest(want, got):
            return None
        data = json.loads(_b64url_decode(body))
        # 5 min clock skew tolerance
        if data.get("exp", 0) < int(time.time()) - 300:
            return None
        return data
    except Exception:
        return None


router = APIRouter(prefix="/api/auth")


@router.get("/me")
def me(request: Request):
    tok = request.cookies.get(COOKIE_NAME)
    data = _verify(tok) if tok else None
    if data and data.get("role") == "admin":
        return {
            "user": {"email": data.get("email"), "is_admin": True, "roles": ["admin"]},
            "roles": ["admin"],
            "is_admin": True,
        }
    return {"user": None, "roles": [], "is_admin": False}


@router.post("/admin/login")
def admin_login(response: Response, email: str):
    email = email.strip().lower()
    
    # Copilot: log a clear marker when handling admin login, printing email suffix
    print(f"[auth] admin_login: email={email.split('@')[0]}@*** (suffix: {email.split('@')[1] if '@' in email else 'N/A'})")
    
    if email not in ADMIN_EMAILS:
        raise HTTPException(403, "not in admin allowlist")
    payload = {
        "email": email,
        "role": "admin",
        "exp": int(time.time()) + COOKIE_MAX_AGE,
    }
    token = _sign(payload)
    rsp = JSONResponse({"ok": True, "email": email})
    # SameSite/Domain: local dev vs prod
    cookie_kwargs = dict(max_age=COOKIE_MAX_AGE, path="/", httponly=True)
    if COOKIE_DOMAIN:  # prod / subdomain scenario
        cookie_kwargs.update(secure=True, samesite="none", domain=COOKIE_DOMAIN)
    else:  # same-origin local dev
        cookie_kwargs.update(samesite="lax")
    rsp.set_cookie(COOKIE_NAME, token, **cookie_kwargs)
    return rsp


@router.post("/admin/logout")
def admin_logout(response: Response):
    rsp = JSONResponse({"ok": True})
    if COOKIE_DOMAIN:
        rsp.delete_cookie(COOKIE_NAME, path="/", domain=COOKIE_DOMAIN)
    else:
        rsp.delete_cookie(COOKIE_NAME, path="/")
    return rsp


def require_admin(request: Request) -> dict[str, Any]:
    tok = request.cookies.get(COOKIE_NAME)
    if not tok:
        raise HTTPException(401, "auth required")
    data = _verify(tok)
    if not data or data.get("role") != "admin":
        raise HTTPException(403, "admin required")
    return data
