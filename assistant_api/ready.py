import os
import sqlite3

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter()

DB_PATH = os.getenv("RAG_DB", "./data/rag.sqlite")


def _ollama_version_url():
    # Prefer OPENAI_BASE_URL (OpenAI-compatible endpoint), else OLLAMA_HOST/PORT, else localhost
    base = os.getenv("OPENAI_BASE_URL")
    if base and ("localhost" in base or "127.0.0.1" in base or "ollama" in base):
        return base.replace("/v1", "/api/version")
    host = os.getenv("OLLAMA_HOST", "localhost")
    port = os.getenv("OLLAMA_PORT", "11434")
    return f"http://{host}:{port}/api/version"


def _read_secret(
    env_name: str, file_env: str, default_file: str | None = None
) -> str | None:
    """Read a secret from env or a file path set via *_FILE; return None if missing."""
    val = os.getenv(env_name)
    if val:
        return val
    fpath = os.getenv(file_env) or default_file
    if fpath and os.path.exists(fpath):
        try:
            with open(fpath, encoding="utf-8") as f:
                return f.read().strip()
        except Exception:
            return None
    return None


@router.get("/ready")
async def ready():
    checks: dict[str, dict] = {}

    # Vector DB check
    try:
        from pathlib import Path

        # Ensure parent directory exists
        db_path = Path(DB_PATH)
        db_path.parent.mkdir(parents=True, exist_ok=True)

        conn = sqlite3.connect(DB_PATH)
        cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1;")
        checks["rag_db"] = {"ok": True, "detail": cur.fetchone()}
        conn.close()
    except Exception as e:
        checks["rag_db"] = {"ok": False, "err": str(e)}

    # Ollama check using consistent URL derivation
    try:
        url = _ollama_version_url()
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(url)
            checks["ollama"] = {"ok": r.status_code == 200}
    except Exception as e:
        checks["ollama"] = {"ok": False, "err": str(e)}

    # Fallback key check (supports env or Docker secret file). Accept either FALLBACK_API_KEY or OPENAI_API_KEY.
    FALLBACK_KEY = _read_secret(
        "FALLBACK_API_KEY", "FALLBACK_API_KEY_FILE", "/run/secrets/openai_api_key"
    )
    OPENAI_KEY = _read_secret(
        "OPENAI_API_KEY", "OPENAI_API_KEY_FILE", "/run/secrets/openai_api_key"
    )
    checks["openai_fallback"] = {"configured": bool(FALLBACK_KEY or OPENAI_KEY)}

    # Overall status: DB must be ok AND at least one LLM path is available
    db_ok = checks.get("rag_db", {}).get("ok", False)
    llm_ok = checks.get("ollama", {}).get("ok") or checks.get(
        "openai_fallback", {}
    ).get("configured")
    ok = bool(db_ok and llm_ok)
    if not ok:
        raise HTTPException(status_code=503, detail={"ok": False, "checks": checks})
    return {"ok": True, "checks": checks}
