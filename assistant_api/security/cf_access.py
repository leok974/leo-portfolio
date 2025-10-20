"""
Production-ready Cloudflare Access JWT validation with JWKS verification.
Includes HMAC dev bypass for CI/local development.
"""
from __future__ import annotations
import os
import time
from typing import Optional, Dict, Any

import jwt  # PyJWT
from fastapi import Header, HTTPException, status

CF_JWT_HEADER = "cf-access-jwt-assertion"


class CFConfig:
    aud: str = os.getenv("CF_ACCESS_AUD", "")
    team_domain: str = os.getenv("CF_ACCESS_TEAM_DOMAIN", "")  # e.g. myteam.cloudflareaccess.com
    jwks_url_override: str = os.getenv("CF_JWKS_URL", "")       # optional override
    leeway: int = int(os.getenv("CF_ACCESS_LEEWAY", "60"))      # clock skew in seconds (default 60)
    dev_bypass_key: str = os.getenv("DEV_HMAC_KEY", "")         # test/dev bypass
    # basic hardening
    algorithms = ["RS256"]

    @property
    def jwks_url(self) -> str:
        if self.jwks_url_override:
            return self.jwks_url_override
        if not self.team_domain:
            return ""
        return f"https://{self.team_domain}/cdn-cgi/access/certs"


# Minimal JWKS cache (PyJWT's PyJWKClient caches internally, but we add a soft TTL)
_JWKS_CACHE: Dict[str, Any] = {}
_JWKS_TTL = 300  # 5 minutes


def _get_jwk_client(url: str) -> jwt.PyJWKClient:
    now = time.time()
    entry = _JWKS_CACHE.get(url)
    if entry and (now - entry["ts"] < _JWKS_TTL):
        return entry["client"]
    client = jwt.PyJWKClient(url)
    _JWKS_CACHE[url] = {"client": client, "ts": now}
    return client


def _bypass_allowed(dev_key: Optional[str]) -> bool:
    cfg = CFConfig()
    return bool(cfg.dev_bypass_key and dev_key and dev_key == cfg.dev_bypass_key)


def _verify_cf_token(cf_jwt: str, cfg: CFConfig) -> Dict[str, Any]:
    if not cfg.aud or not cfg.team_domain:
        raise HTTPException(status_code=500, detail="CF Access not configured")

    jwks_url = cfg.jwks_url
    if not jwks_url:
        raise HTTPException(status_code=500, detail="CF JWKS URL not available")

    try:
        jwk_client = _get_jwk_client(jwks_url)
        signing_key = jwk_client.get_signing_key_from_jwt(cf_jwt)
        # Verify signature + claims (aud & exp/nbf/iat with leeway)
        payload = jwt.decode(
            cf_jwt,
            signing_key.key,
            algorithms=cfg.algorithms,
            audience=cfg.aud,
            leeway=cfg.leeway,
            options={"require": ["exp", "iat"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="CF token expired")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="CF audience mismatch")
    except jwt.InvalidIssuedAtError:
        raise HTTPException(status_code=401, detail="CF token iat invalid")
    except jwt.InvalidSignatureError:
        raise HTTPException(status_code=401, detail="CF token signature invalid")
    except Exception as e:
        # Keep this generic to avoid leaking internals
        raise HTTPException(status_code=401, detail="CF token verification failed") from e


def require_cf_access(
    cf_jwt: Optional[str] = Header(None, alias=CF_JWT_HEADER),
    dev_key: Optional[str] = Header(None, alias="x-dev-key"),
):
    """
    Auth strategy:
    1) Dev/HMAC bypass (CI/local): header x-dev-key == DEV_HMAC_KEY -> allow
    2) Otherwise: Verify CF JWT via Cloudflare JWKS (RS256), enforce 'aud'
    """
    cfg = CFConfig()

    # 1) Dev bypass for tests & local tools
    if _bypass_allowed(dev_key):
        return {"subject": "dev-bypass", "mode": "hmac"}

    # 2) Require CF token in prod paths
    if not cf_jwt:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing CF Access token")

    return _verify_cf_token(cf_jwt, cfg)
