"""
Dependencies package for FastAPI.
"""
from .auth import require_api_key, require_dev_auth

__all__ = ["require_api_key", "require_dev_auth"]
