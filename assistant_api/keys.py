import os
from typing import Optional


def _read_secret_file(path: str) -> str | None:
    try:
        if path and os.path.isfile(path):
            with open(path, encoding="utf-8") as f:
                val = f.read().strip()
                return val or None
    except Exception:
        return None
    return None


def is_openai_configured() -> bool:
    if os.getenv("OPENAI_API_KEY"):
        return True
    key_file = os.getenv("OPENAI_API_KEY_FILE")
    if key_file and _read_secret_file(key_file):
        return True
    return False
