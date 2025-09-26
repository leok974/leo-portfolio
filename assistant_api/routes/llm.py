from fastapi import APIRouter, Query
import os
import logging
from ..llm_client import (
    primary_list_models,
    primary_chat,
    OPENAI_MODEL,
    PRIMARY_BASE,
    PRIMARY_MODEL_PRESENT,
    DISABLE_PRIMARY,
    PRIMARY_MODELS,
)

router = APIRouter(prefix="/llm", tags=["llm"])
logging.getLogger("uvicorn.error").info("LLM routes loaded: /llm/diag /llm/models /llm/primary/ping")


@router.get("/diag")
def llm_diag():
    return {
        "primary": {
            "base_url": os.getenv("OPENAI_BASE_URL", "http://ollama:11434/v1"),
            "model": os.getenv("OPENAI_MODEL", "gpt-oss:20b"),
            "disabled": os.getenv("DISABLE_PRIMARY") in ("1", "true", "True"),
        },
        "fallback": {
            "base_url": os.getenv("FALLBACK_BASE_URL", "https://api.openai.com/v1"),
            "model": os.getenv("FALLBACK_MODEL", "gpt-4o-mini"),
            "key_present": bool(
                os.getenv("FALLBACK_API_KEY")
                or (os.getenv("FALLBACK_API_KEY_FILE") and os.path.exists(os.getenv("FALLBACK_API_KEY_FILE")))
                or os.path.exists("/run/secrets/openai_api_key")
                or os.getenv("OPENAI_API_KEY")
                or (os.getenv("OPENAI_API_KEY_FILE") and os.path.exists(os.getenv("OPENAI_API_KEY_FILE")))
            ),
        },
        "rag_url": os.getenv("RAG_URL", "http://127.0.0.1:8001/api/rag/query"),
    }

@router.get("/models")
async def models(refresh: bool = Query(False, description="Refresh primary model list")):
    global PRIMARY_MODEL_PRESENT
    if refresh:
        data = await primary_list_models()
        # Update in-place so any other references see latest
        PRIMARY_MODELS.clear()
        PRIMARY_MODELS.extend(data)
        PRIMARY_MODEL_PRESENT = (OPENAI_MODEL in data) or any(
            (m or "").lower().startswith(OPENAI_MODEL.lower()) for m in data
        )
    else:
        # If not refreshing, still ensure we have something (lazy load on first call)
        if not PRIMARY_MODELS:
            data = await primary_list_models()
            PRIMARY_MODELS.clear()
            PRIMARY_MODELS.extend(data)
        data = list(PRIMARY_MODELS)
    return {
        "base_url": PRIMARY_BASE,
        "data": data,
        "model_present": bool(PRIMARY_MODEL_PRESENT),
        "target": OPENAI_MODEL,
        "refreshed": refresh,
    }

@router.get("/primary/ping")
async def primary_ping():
    if DISABLE_PRIMARY:
        return {"ok": False, "reason": "disabled"}
    j, reason, status = await primary_chat([{"role": "user", "content": "ping"}], max_tokens=1)
    if j is not None:
        return {"ok": True, "served_by": "primary", "model": OPENAI_MODEL}
    return {"ok": False, "reason": reason, "status": status}
