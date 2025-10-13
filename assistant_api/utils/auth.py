from __future__ import annotations

import os

from fastapi import Request

# Simple, portable admin check:
# - DEV override: ALLOW_TOOLS=1 → treat as admin
# - PROD: require X-Admin-Token header matching ADMIN_TOKEN env


def get_current_user(request: Request):
    if os.environ.get("ALLOW_TOOLS", "0") == "1":
        return {"role": "admin", "email": "local@dev"}

    admin_token = os.environ.get("ADMIN_TOKEN", "")
    if not admin_token:
        return None

    token = request.headers.get("X-Admin-Token") or ""
    if token and token == admin_token:
        return {"role": "admin", "email": "token@admin"}
    return None
