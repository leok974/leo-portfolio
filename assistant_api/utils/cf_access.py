"""
Cloudflare Access JWT Verification

Verifies Cf-Access-Jwt-Assertion headers against Cloudflare's JWKS endpoint.
Enforces allowed emails if configured.

Environment Variables:
    CF_ACCESS_TEAM_DOMAIN: Your Cloudflare Access team domain (e.g., yourteam.cloudflareaccess.com)
    CF_ACCESS_AUD: Application Audience (AUD) tag from CF Access
    ACCESS_ALLOWED_EMAILS: Comma-separated list of allowed emails (optional extra filter for user SSO)
    ACCESS_ALLOWED_SERVICE_SUBS: Comma-separated list of allowed service token subjects (optional extra filter)

Usage:
    from assistant_api.utils.cf_access import require_cf_access

    router = APIRouter(
        prefix="/api/secure",
        dependencies=[Depends(require_cf_access)]
    )
"""
from __future__ import annotations
import os
import time
import json
import urllib.request
import jwt
import logging
from fastapi import Request, HTTPException

logger = logging.getLogger(__name__)

TEAM_DOMAIN = os.getenv("CF_ACCESS_TEAM_DOMAIN")  # e.g. yourteam.cloudflareaccess.com
AUD = os.getenv("CF_ACCESS_AUD")                  # CF Access app AUD tag
ALLOWED_EMAILS = {e.strip().lower() for e in os.getenv("ACCESS_ALLOWED_EMAILS", "").split(",") if e.strip()}
ALLOWED_SERVICE_SUBS = {s.strip() for s in os.getenv("ACCESS_ALLOWED_SERVICE_SUBS", "").split(",") if s.strip()}

_JWKS_CACHE = {"ts": 0, "keys": {}}


def _fetch_jwks() -> dict:
    """Fetch JWKS from Cloudflare Access certs endpoint."""
    if not TEAM_DOMAIN:
        raise RuntimeError("CF_ACCESS_TEAM_DOMAIN not set")
    url = f"https://{TEAM_DOMAIN}/cdn-cgi/access/certs"
    with urllib.request.urlopen(url, timeout=5) as resp:
        return json.loads(resp.read().decode())


def _get_key_for_kid(kid: str):
    """Get RSA public key for given kid, with 10-minute cache."""
    now = time.time()
    if now - _JWKS_CACHE["ts"] > 600 or not _JWKS_CACHE["keys"]:
        jwks = _fetch_jwks()
        _JWKS_CACHE["keys"] = {k["kid"]: k for k in jwks.get("keys", [])}
        _JWKS_CACHE["ts"] = now

    jwk = _JWKS_CACHE["keys"].get(kid)
    if not jwk:
        # Refresh once in case of key rotation
        _JWKS_CACHE["ts"] = 0
        jwks_data = _fetch_jwks()
        _JWKS_CACHE["keys"] = {k["kid"]: k for k in jwks_data.get("keys", [])}
        jwk = _JWKS_CACHE["keys"].get(kid)

    if not jwk:
        raise HTTPException(401, "Unable to verify Access token (unknown key)")

    return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk))


def require_cf_access(request: Request) -> str:
    """
    FastAPI dependency to require valid Cloudflare Access JWT.

    Accepts either:
    - User SSO tokens (contains email claim)
    - Service tokens (contains sub claim with token name)

    Returns:
        str: Principal identifier (email for users, subject for service tokens)

    Raises:
        HTTPException: 403 if header missing, 401 if JWT invalid, 403 if principal not allowed
    """
    token = request.headers.get("Cf-Access-Jwt-Assertion")
    if not token:
        # If you ONLY reach origin via Cloudflare Tunnel, header spoofing is unlikely,
        # but we still require the signed JWT for defense-in-depth.
        raise HTTPException(403, "Cloudflare Access required")

    # DEBUG: Log JWT claims without verification to see what CF is sending
    try:
        unverified_claims = jwt.decode(token, options={"verify_signature": False})
        logger.info(f"🔍 JWT Debug - sub: {unverified_claims.get('sub')}, email: {unverified_claims.get('email')}, aud: {unverified_claims.get('aud')}, iss: {unverified_claims.get('iss')}")
        logger.info(f"🔍 Backend expects - AUD: {AUD}, ALLOWED_SERVICE_SUBS: {ALLOWED_SERVICE_SUBS}, ALLOWED_EMAILS: {ALLOWED_EMAILS}")
    except Exception as e:
        logger.warning(f"⚠️ Could not decode JWT for debugging: {e}")

    unverified = jwt.get_unverified_header(token)
    key = _get_key_for_kid(unverified.get("kid", ""))

    opts = {"verify_exp": True, "verify_aud": bool(AUD)}
    try:
        claims = jwt.decode(
            token,
            key=key,
            algorithms=["RS256", "ES256"],  # CF can use either
            audience=AUD if AUD else None,
            options=opts,
        )
    except jwt.PyJWTError as e:
        logger.error(f"❌ JWT validation failed: {e}")
        raise HTTPException(401, f"Invalid Access token: {e}")

    # Accept either end-user SSO (email) or service token (subject/common_name)
    # For service tokens, CF Access puts the client ID in 'common_name', not token name in 'sub'
    principal = (
        claims.get("email") or
        claims.get("identity") or
        claims.get("sub") or
        claims.get("common_name") or
        ""
    ).strip()

    if not principal:
        logger.error(f"❌ JWT missing principal - claims: {claims}")
        raise HTTPException(403, "Access token missing subject")

    # If it looks like an email, enforce email allowlist; otherwise enforce service-token allowlist
    if "@" in principal:
        principal_lower = principal.lower()
        if ALLOWED_EMAILS and principal_lower not in ALLOWED_EMAILS:
            logger.error(f"❌ Email not allowed: {principal_lower}, allowed: {ALLOWED_EMAILS}")
            raise HTTPException(403, "Not allowed (email)")
        logger.info(f"✅ Email authenticated: {principal_lower}")
        return principal_lower
    else:
        # For service tokens, principal will be the client ID (common_name)
        # Check if it's in the allowed list (can be client ID or token name)
        if ALLOWED_SERVICE_SUBS and principal not in ALLOWED_SERVICE_SUBS:
            logger.error(f"❌ Service token not allowed: {principal}, allowed: {ALLOWED_SERVICE_SUBS}")
            raise HTTPException(403, "Not allowed (service)")
        logger.info(f"✅ Service token authenticated: {principal}")
        return principal
