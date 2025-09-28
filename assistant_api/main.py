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
from .status_common import build_status
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

raw_origins = os.getenv("ALLOWED_ORIGINS", "")
# Support comma, space, or newline separated entries
tokens = []
for part in raw_origins.replace("\n", ",").replace(" ", ",").split(","):
    part = part.strip()
    if part:
        tokens.append(part)
origins = tokens
allow_all = os.getenv("CORS_ALLOW_ALL", "0") in {"1", "true", "TRUE", "yes", "on"}
if allow_all:
    # Fast path: allow all origins for temporary troubleshooting (avoid in prod long-term)
    origins = ["*"]
if not origins:
    origins = [
        "https://leok974.github.io",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:5530",
        "http://127.0.0.1:5530",
    ]

if origins == ["*"]:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,  # cannot use credentials with wildcard origin
        allow_methods=["*"],
        allow_headers=["*"]
    )
else:
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
@app.get("/status/summary")
async def status_summary_ep():
    base = os.getenv("BASE_URL_PUBLIC", "http://127.0.0.1:8001")
    summary = await build_status(base)
    summary["latency_recent"] = recent_latency_stats()
    summary["latency_recent_by_provider"] = recent_latency_stats_by_provider()
    summary["last_served_by"] = LAST_SERVED_BY
    return summary


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







