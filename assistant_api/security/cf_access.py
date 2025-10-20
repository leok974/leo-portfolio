"""
Cloudflare Access JWT validation with dev/HMAC bypass for testing.
"""
from fastapi import Header, HTTPException, status
import os
import jwt

CF_JWT_HEADER = "cf-access-jwt-assertion"


class CFConfig:
    aud = os.getenv("CF_ACCESS_AUD", "")
    team_domain = os.getenv("CF_ACCESS_TEAM_DOMAIN", "")  # e.g. your-team.cloudflareaccess.com
    # DEV bypass: set a shared HMAC key to allow tests/local without CF
    dev_bypass_key = os.getenv("DEV_HMAC_KEY", "")


def _bypass_allowed(dev_key: str | None) -> bool:
    cfg = CFConfig()
    return bool(cfg.dev_bypass_key and dev_key and dev_key == cfg.dev_bypass_key)


def require_cf_access(
    cf_jwt: str | None = Header(None, alias=CF_JWT_HEADER),
    dev_key: str | None = Header(None, alias="x-dev-key"),
):
    """
    Require Cloudflare Access JWT or dev bypass key.
    
    Dev bypass: If DEV_HMAC_KEY env var is set and matches x-dev-key header,
    bypass CF Access validation (for tests/CI/local dev).
    """
    # DEV bypass path (used by tests/CI and local)
    if _bypass_allowed(dev_key):
        return {"subject": "dev-bypass"}

    if not cf_jwt:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing CF Access token"
        )

    cfg = CFConfig()
    if not (cfg.aud and cfg.team_domain):
        raise HTTPException(status_code=500, detail="CF Access not configured")

    # Minimal validation: decode w/o verify to check aud
    # In production, validate using CF JWKS endpoint
    try:
        payload = jwt.decode(
            cf_jwt,
            options={"verify_signature": False, "verify_aud": False}
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid CF token")

    aud = payload.get("aud")
    if isinstance(aud, list):
        ok = cfg.aud in aud
    else:
        ok = (aud == cfg.aud)
    
    if not ok:
        raise HTTPException(status_code=401, detail="CF audience mismatch")
    
    return payload
