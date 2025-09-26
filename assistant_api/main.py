from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import os
from pathlib import Path
from .rag_query import router as rag_router
from .rag_ingest import ingest
from .llm_client import (
    chat as llm_chat,
    chat_stream as llm_chat_stream,
    diag as llm_diag,
    primary_list_models,
    PRIMARY_MODELS,
    PRIMARY_MODEL_PRESENT,
    OPENAI_MODEL as PRIMARY_MODEL_NAME,
    PRIMARY_BASE as PRIMARY_BASE_URL,
    LAST_PRIMARY_ERROR,
    LAST_PRIMARY_STATUS,
    DISABLE_PRIMARY,
)
from .auto_rag import needs_repo_context, fetch_context, build_context_message
from .llm_health import router as llm_health_router
from .ready import router as ready_router
from .metrics import record, snapshot, recent_latency_stats, recent_latency_stats_by_provider
from .routes import status as status_routes, llm as llm_routes
from .routes import llm_latency as llm_latency_routes
from .health import router as health_router
import httpx
import time
import json
try:
    # Load .env and .env.local if present (dev convenience)
    from dotenv import load_dotenv
    here = Path(__file__).parent
    load_dotenv(here / ".env")
    load_dotenv(here / ".env.local")
except Exception:
    pass

# If running locally, allow reading OpenAI key from secrets/openai_api_key
try:
    secrets_file = Path(__file__).resolve().parents[1] / "secrets" / "openai_api_key"
    if secrets_file.exists():
        val = secrets_file.read_text(encoding="utf-8").strip()
        os.environ.setdefault("OPENAI_API_KEY", val)
        os.environ.setdefault("FALLBACK_API_KEY", val)
except Exception:
    pass

from .lifespan import lifespan

app = FastAPI(title="Leo Portfolio Assistant", lifespan=lifespan)

# Track last provider that served a response (primary|fallback|none)
LAST_SERVED_BY: dict[str, str | float] = {"provider": "none", "ts": 0.0}

origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
if not origins:
    origins = [
        "https://leok974.github.io",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:5530",
        "http://127.0.0.1:5530",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# RAG API routes
app.include_router(rag_router, prefix="/api")
app.include_router(llm_health_router)
app.include_router(ready_router)
app.include_router(status_routes.router)
app.include_router(llm_routes.router)
app.include_router(health_router)
app.include_router(llm_latency_routes.router)

## Startup logic migrated to lifespan context in lifespan.py

@app.middleware("http")
async def _metrics_middleware(request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
        return response
    finally:
        duration_ms = (time.perf_counter() - start) * 1000
        try:
            status = getattr(locals().get('response', None), 'status_code', 500)
        except Exception:
            status = 500
        record(status, duration_ms)

@app.get("/metrics")
def metrics():
    return snapshot()

# Lightweight built-in status summary endpoint (mirrors routes.status)
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

@app.get("/status/summary")
async def status_summary_ep():
    base = os.getenv("BASE_URL_PUBLIC", "http://127.0.0.1:8001")
    openai_configured = bool(
        _read_secret("OPENAI_API_KEY", "OPENAI_API_KEY_FILE", "/run/secrets/openai_api_key")
        or _read_secret("FALLBACK_API_KEY", "FALLBACK_API_KEY_FILE", "/run/secrets/openai_api_key")
    )
    llm = {"path": "down", "model": os.getenv("OPENAI_MODEL", "gpt-oss:20b")}
    rag = {"ok": False, "db": os.getenv("RAG_DB", "data/rag.sqlite")}
    ready_ok = False
    try:
        async with httpx.AsyncClient(timeout=3.0) as x:
            # LLM health
            try:
                r = await x.get(f"{base}/llm/health")
                if r.status_code == 200:
                    st = (r.json() or {}).get("status", {})
                    if st.get("ollama") == "up":
                        llm["path"] = "local"
                    elif st.get("openai") == "configured":
                        llm["path"] = "fallback"
            except Exception:
                pass
            # Ready
            try:
                r2 = await x.get(f"{base}/ready")
                ready_ok = (r2.status_code == 200)
            except Exception:
                ready_ok = False
            # RAG quick probe
            try:
                r3 = await x.post(f"{base}/api/rag/query", json={"question": "ping", "k": 1})
                rag["ok"] = (r3.status_code == 200)
            except Exception:
                rag["ok"] = False
    except Exception:
        pass
    primary_info = {
        "base_url": PRIMARY_BASE_URL,
        "model": PRIMARY_MODEL_NAME,
        "enabled": not DISABLE_PRIMARY,
        "model_present": globals().get("PRIMARY_MODEL_PRESENT"),
        "models_sample": PRIMARY_MODELS[:8],
        "last_error": globals().get("LAST_PRIMARY_ERROR"),
        "last_status": globals().get("LAST_PRIMARY_STATUS"),
    }
    return {
        "llm": llm,
        "openai_configured": openai_configured,
        "rag": rag,
        "ready": ready_ok,
        "latency_recent": recent_latency_stats(),
    "latency_recent_by_provider": recent_latency_stats_by_provider(),
        "metrics_hint": {"providers": ["primary", "fallback"], "fields": ["req", "5xx", "p95_ms", "tok_in", "tok_out"]},
        "tooltip": f"Ollama/OpenAI configured: {openai_configured}. RAG DB: {rag.get('db')}",
        "last_served_by": LAST_SERVED_BY,
        "primary": primary_info,
    }

class ChatReq(BaseModel):
    messages: list
    context: dict | None = None
    stream: bool | None = False

SYSTEM_PROMPT = (
    "You are Leo’s portfolio assistant. Be concise and specific. Recommend the most relevant "
    "project (LedgerMind, DataPipe AI, Clarity Companion), give one-sentence value + 3 bullets "
    "(tech/impact/why hireable), then end with actions: [Case Study] • [GitHub] • [Schedule]. "
    "If unsure, say so briefly."
)

def _build_messages(req: ChatReq):
    msgs = [{"role": "system", "content": SYSTEM_PROMPT}]
    if req.context:
        msgs.append({"role": "system", "content": f"Site context:\n{req.context.get('summary','')[:2000]}"})
    msgs += req.messages[-8:]
    return msgs

@app.post("/chat")
async def chat(req: ChatReq):
    messages = _build_messages(req)
    # auto-RAG: peek at latest user message
    user_last = next((m for m in reversed(messages) if m.get("role") == "user"), None)
    if user_last and needs_repo_context(user_last.get("content", "")):
        try:
            matches = await fetch_context(user_last["content"])
            if matches:
                messages = [build_context_message(matches)] + messages
        except Exception:
            pass
    try:
        tag, resp = await llm_chat(messages, stream=False)
        data = resp.json()
        data["_served_by"] = tag
        try:
            import time as _t
            LAST_SERVED_BY["provider"] = tag
            LAST_SERVED_BY["ts"] = _t.time()
            # update last primary diagnostics if available
            globals()["LAST_PRIMARY_ERROR"] = globals().get("LAST_PRIMARY_ERROR")
            globals()["LAST_PRIMARY_STATUS"] = globals().get("LAST_PRIMARY_STATUS")
        except Exception:
            pass
        return data
    except Exception as e:
        # Gather rich debug info when provider calls fail
        debug = {"type": type(e).__name__, "msg": str(e)}
        # httpx.HTTPStatusError exposes .response with status/text
        try:
            resp = getattr(e, "response", None)
            if resp is not None:
                # Avoid huge bodies
                body_text = None
                try:
                    body_text = resp.text
                except Exception:
                    body_text = None
                debug.update({
                    "status": getattr(resp, "status_code", None),
                    "body": (body_text[:400] if isinstance(body_text, str) else None)
                })
        except Exception:
            pass
        # Include non-secret runtime diag
        try:
            debug["llm"] = llm_diag()
        except Exception:
            pass
        try:
            print("/chat error:", debug)
        except Exception:
            pass
        # Friendly 503 with debug payload
        detail = {"error": "All providers unavailable. Try again later.", "debug": debug}
        raise HTTPException(status_code=503, detail=detail)

@app.post("/chat/stream")
async def chat_stream_ep(req: ChatReq):
    messages = _build_messages(req)

    async def gen():
        source = None
        async for tag, line in llm_chat_stream(messages):
            if source is None:
                source = tag
                try:
                    import time as _t
                    LAST_SERVED_BY["provider"] = tag
                    LAST_SERVED_BY["ts"] = _t.time()
                except Exception:
                    pass
                meta = {"_served_by": source}
                yield f"event: meta\ndata: {json.dumps(meta)}\n\n"
            # passthrough OpenAI-style data lines
            if not line.startswith("data:"):
                line = f"data: {line}"
            yield line + "\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")

@app.post("/api/rag/ingest")
async def trigger_ingest():
    await ingest()
    return {"ok": True}







