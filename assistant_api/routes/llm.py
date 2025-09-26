from fastapi import APIRouter, Query
from time import perf_counter
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
    get_primary_status,
    get_fallback_status,
)

router = APIRouter(prefix="/llm", tags=["llm"])
logging.getLogger("uvicorn.error").info("LLM routes loaded: /llm/diag /llm/models /llm/primary/ping")


@router.get("/diag")
def llm_diag():
    primary = get_primary_status()
    fallback = get_fallback_status()
    return {
        "primary": primary,
        "fallback": fallback,
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


@router.get("/primary/latency")
async def primary_latency(n: int = 1):
    """Run up to 5 micro chat calls (1 token) and report per-run latency.

    Query param n limits number of samples (1..5). Each run attempts a minimal
    primary_chat request; failures are captured with reason/status for diagnostics.
    """
    runs = []
    for _ in range(max(1, min(n, 5))):
        t0 = perf_counter()
        j, reason, status = await primary_chat([{"role": "user", "content": "."}], max_tokens=1)
        dt = (perf_counter() - t0) * 1000
        runs.append({
            "ms": round(dt, 2),
            "ok": j is not None,
            "reason": None if j is not None else reason,
            "status": status,
        })
    ok_lat = [r["ms"] for r in runs if r["ok"]]
    p50 = None
    if ok_lat:
        s = sorted(ok_lat)
        p50 = s[len(s)//2]
    return {"runs": runs, "p50_ms": p50}
