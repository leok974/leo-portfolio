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
from .state import LAST_SERVED_BY
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


raw_origins = os.getenv("ALLOWED_ORIGINS", "")
# Support comma, space, or newline separated entries
tokens: list[str] = []
for part in raw_origins.replace("\n", ",").replace(" ", ",").split(","):
    part = part.strip()
    if part:
        tokens.append(part)

# Derive origins automatically from DOMAIN env if present
DOMAIN = os.getenv("DOMAIN", "").strip().rstrip('/')
derived_origins: list[str] = []
if DOMAIN:
    # Accept bare domain like example.com or with scheme; normalize
    if DOMAIN.startswith("http://") or DOMAIN.startswith("https://"):
        base_domain = DOMAIN.split("//", 1)[1]
    else:
        base_domain = DOMAIN
    base_domain = base_domain.rstrip('/')
    # Build candidate HTTPS + HTTP (HTTPS first), include www variant
    candidates = [
        f"https://{base_domain}",
        f"http://{base_domain}",
    ]
    if not base_domain.startswith("www."):
        candidates.extend([
            f"https://www.{base_domain}",
            f"http://www.{base_domain}",
        ])
    # Only add if not already explicitly listed
    for c in candidates:
        if c not in tokens:
            derived_origins.append(c)
    tokens.extend(derived_origins)

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

# Store CORS config metadata for health endpoint
_CORS_META = {
    "raw_env": raw_origins,
    "allow_all": allow_all,
    "allowed_origins": origins,
    "derived_from_domain": derived_origins,
    "domain_env": DOMAIN,
}

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

# Conditional preflight (CORS) logging middleware
if os.getenv("CORS_LOG_PREFLIGHT", "0") in {"1", "true", "TRUE", "yes", "on"}:
    @app.middleware("http")
    async def _cors_preflight_logger(request, call_next):  # type: ignore
        # Only log OPTIONS or requests with Origin header
        if request.method == "OPTIONS" or request.headers.get("origin"):
            try:
                print("[CORS] method=", request.method,
                      "origin=", request.headers.get("origin"),
                      "acr-method=", request.headers.get("access-control-request-method"),
                      "acr-headers=", request.headers.get("access-control-request-headers"))
            except Exception:
                pass
        return await call_next(request)

@app.get("/metrics")
def metrics():
    return snapshot()


@app.get("/status/cors")
async def status_cors():
    # Return a shallow copy plus timestamp so we don't mutate original meta by accident
    data = dict(_CORS_META)
    try:
        data["timestamp"] = time.time()
    except Exception:
        pass
    return data


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







