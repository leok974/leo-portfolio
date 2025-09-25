import os, sqlite3, httpx
from fastapi import APIRouter, HTTPException

router = APIRouter()

DB_PATH = os.getenv("RAG_DB", "./data/rag.sqlite")
def _read_secret(env_name: str, file_env: str, default_file: str | None = None) -> str | None:
    """Read a secret from env or a file path set via *_FILE; return None if missing."""
    val = os.getenv(env_name)
    if val:
        return val
    fpath = os.getenv(file_env) or default_file
    if fpath and os.path.exists(fpath):
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                return f.read().strip()
        except Exception:
            return None
    return None


@router.get("/ready")
async def ready():
    checks: dict[str, dict] = {}

    # Vector DB check
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1;")
        checks["rag_db"] = {"ok": True, "detail": cur.fetchone()}
        conn.close()
    except Exception as e:
        checks["rag_db"] = {"ok": False, "err": str(e)}

    # Ollama check (only if base URL points to Ollama)
    OLLAMA_URL = os.getenv("OPENAI_BASE_URL", "http://ollama:11434/v1")
    try:
        if "ollama" in OLLAMA_URL:
            async with httpx.AsyncClient(timeout=3.0) as client:
                r = await client.get(OLLAMA_URL.replace("/v1", "/api/version"))
                checks["ollama"] = {"ok": r.status_code == 200}
        else:
            checks["ollama"] = {"skipped": True}
    except Exception as e:
        checks["ollama"] = {"ok": False, "err": str(e)}

    # Fallback key check (supports env or Docker secret file). Accept either FALLBACK_API_KEY or OPENAI_API_KEY.
    FALLBACK_KEY = _read_secret("FALLBACK_API_KEY", "FALLBACK_API_KEY_FILE", "/run/secrets/openai_api_key")
    OPENAI_KEY = _read_secret("OPENAI_API_KEY", "OPENAI_API_KEY_FILE", "/run/secrets/openai_api_key")
    checks["openai_fallback"] = {"configured": bool(FALLBACK_KEY or OPENAI_KEY)}

    # Overall status: DB must be ok AND at least one LLM path is available
    db_ok = checks.get("rag_db", {}).get("ok", False)
    llm_ok = checks.get("ollama", {}).get("ok") or checks.get("openai_fallback", {}).get("configured")
    ok = bool(db_ok and llm_ok)
    if not ok:
        raise HTTPException(status_code=503, detail={"ok": False, "checks": checks})
    return {"ok": True, "checks": checks}
