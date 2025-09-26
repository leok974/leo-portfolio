from fastapi import APIRouter
from pydantic import BaseModel
import os
import httpx
import os.path

router = APIRouter()


class Status(BaseModel):
    llm: dict  # { path: "local"|"fallback"|"down", model: str|None }
    openai_configured: bool
    rag: dict  # { ok: bool, db: str }
    ready: bool
    metrics_hint: dict
    tooltip: str | None = None


def _read_secret(env_name: str, file_env: str, default_file: str | None = None) -> str | None:
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


async def _get_llm_health(client: httpx.AsyncClient, base: str):
    try:
        r = await client.get(f"{base}/llm/health", timeout=3.0)
        if r.status_code == 200:
            j = r.json() or {}
            # Current llm_health returns { ok, status: { ollama, openai } }
            st = j.get("status", {}) if isinstance(j, dict) else {}
            ollama = st.get("ollama")
            openai = st.get("openai")
            if ollama == "up":
                path = "local"
            elif openai == "configured":
                path = "fallback"
            else:
                path = "down"
            return {"path": path, "model": os.getenv("OPENAI_MODEL", "gpt-oss:20b")}
    except Exception:
        pass
    return {"path": "down", "model": None}


async def _get_ready(client: httpx.AsyncClient, base: str) -> bool:
    try:
        r = await client.get(f"{base}/ready", timeout=3.0)
        return r.status_code == 200
    except Exception:
        return False


async def _get_rag_ok(client: httpx.AsyncClient, base: str):
    # Fast probe: call /api/rag/query with small k
    try:
        r = await client.post(f"{base}/api/rag/query", json={"question": "ping", "k": 1}, timeout=3.0)
        ok = r.status_code == 200
        return {"ok": ok, "db": os.getenv("RAG_DB", "data/rag.sqlite")}
    except Exception:
        return {"ok": False, "db": os.getenv("RAG_DB", "data/rag.sqlite")}


@router.get("/status/summary", response_model=Status)
async def status_summary():
    base = os.getenv("BASE_URL_PUBLIC", "http://127.0.0.1:8001")
    # OpenAI configured: accept either fallback or primary key via env or *_FILE or docker secret
    openai_configured = bool(
        _read_secret("OPENAI_API_KEY", "OPENAI_API_KEY_FILE", "/run/secrets/openai_api_key")
        or _read_secret("FALLBACK_API_KEY", "FALLBACK_API_KEY_FILE", "/run/secrets/openai_api_key")
    )

    async with httpx.AsyncClient() as client:
        llm = await _get_llm_health(client, base)
        ready = await _get_ready(client, base)
        rag = await _get_rag_ok(client, base)

    tip = f"Ollama/OpenAI configured: {openai_configured}. RAG DB: {rag.get('db')}"
    return Status(
        llm=llm,
        openai_configured=openai_configured,
        rag=rag,
        ready=ready,
        metrics_hint={"providers": ["primary", "fallback"], "fields": ["req", "5xx", "p95_ms", "tok_in", "tok_out"]},
        tooltip=tip,
    )
