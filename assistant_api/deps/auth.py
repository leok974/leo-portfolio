"""
Authentication dependency for FastAPI routes.
Ensures privileged endpoints return 401/403 correctly.
"""
from fastapi import Header, HTTPException, status
import os

API_KEY_HEADER = "x-api-key"
DEV_AUTH_HEADER = "authorization"


def require_api_key(
    x_api_key: str | None = Header(default=None, alias=API_KEY_HEADER)
) -> bool:
    """
    Require valid API key for privileged endpoints.

    Raises:
        401 if missing API key
        403 if invalid API key
    """
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key"
        )

    # Check against environment variable
    expected_key = os.getenv("INTERNAL_API_KEY", "dev-key-change-in-prod")
    if x_api_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key"
        )

    return True


def require_dev_auth(
    authorization: str | None = Header(default=None, alias=DEV_AUTH_HEADER)
) -> bool:
    """
    Require dev auth (Bearer token) for dev overlay endpoints.

    Raises:
        401 if missing authorization
        403 if invalid token
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header"
        )

    # Check for Bearer token
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format (expected 'Bearer <token>')"
        )

    token = authorization.replace("Bearer ", "").strip()

    # In dev/test, accept "dev" token; in prod, check against env
    expected_token = os.getenv("DEV_TOKEN", "dev")
    if token != expected_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid dev token"
        )

    return True
