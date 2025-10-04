from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import os
import os.path as _ospath
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
from fastapi import APIRouter
from .metrics import record, snapshot, recent_latency_stats, recent_latency_stats_by_provider, stage_snapshot
from .routes import status as status_routes, llm as llm_routes
from .routes import llm_latency as llm_latency_routes
from .health import router as health_router
from .status_common import build_status
from .state import LAST_SERVED_BY, sse_inc, sse_dec
import httpx
import time
import json
import sqlite3 as _sqlite3
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
from . import settings as _settings

app = FastAPI(title="Leo Portfolio Assistant", lifespan=lifespan)

_CORS_META = _settings.get_settings()
origins = _CORS_META["allowed_origins"]
allow_all = _CORS_META["allow_all"]

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

# Ultra-fast ping for UI hydration fallback (/api/ping)
_ping_router = APIRouter()

@_ping_router.get('/api/ping')
async def ping():
    return {"ok": True}

@_ping_router.get('/api/ready')
async def quick_ready():
    rag_db = os.getenv("RAG_DB")
    rag = {"db": rag_db, "chunks": None, "ok": False}
    if rag_db and _ospath.exists(rag_db):
        try:
            con = _sqlite3.connect(rag_db)
            cur = con.cursor()
            cur.execute("select count(*) from chunks")
            rag["chunks"] = int(cur.fetchone()[0])
            rag["ok"] = rag["chunks"] > 0
        except Exception as e:
            rag["error"] = str(e)
        finally:
            try:
                con.close()
            except Exception:
                pass
    return {"ok": True, "rag": rag, "metrics": stage_snapshot()}

@_ping_router.get('/api/metrics')
async def metrics_json():
    """Lightweight JSON metrics for embeddings/rerank/gen (counts, last latency, last backend)."""
    return {"ok": True, "metrics": stage_snapshot()}

@_ping_router.get('/api/metrics.csv')
async def metrics_csv():
    """CSV view of the same metrics."""
    snap = stage_snapshot()
    lines = ["stage,count,last_ms,last_backend"]
    for stage, m in snap.items():
        count = m.get("count", 0)
        last_ms = "" if m.get("last_ms") is None else m.get("last_ms")
        last_backend = m.get("last_backend") or ""
        lines.append(f"{stage},{count},{last_ms},{last_backend}")
    csv = "\n".join(lines) + "\n"
    return Response(
        content=csv,
        media_type="text/csv; charset=utf-8",
        headers={"Cache-Control": "no-store"}
    )

app.include_router(_ping_router)
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
    data = dict(_CORS_META)
    data["timestamp"] = time.time()
    return data


class ChatReq(BaseModel):
    messages: list
    context: dict | None = None
    stream: bool | None = False
    include_sources: bool | None = False

SYSTEM_PROMPT = (
    "You are Leo’s portfolio assistant speaking to a site visitor (third person about Leo). "
    "Be concise and specific. Prefer facts grounded in the provided Sources/Snippets; do not invent details. "
    "When the user asks about projects, pick the best match (e.g., LedgerMind, DataPipe AI, Clarity Companion), "
    "give one-sentence value + 3 short bullets (tech/impact/why hireable). If no grounding sources are available, "
    "avoid specific claims and offer to share the case study or a 60‑sec demo instead. "
    "Always end with a short, visitor‑friendly follow-up question."
)

def _build_messages(req: ChatReq):
    msgs = [{"role": "system", "content": SYSTEM_PROMPT}]
    if req.context:
        msgs.append({"role": "system", "content": f"Site context:\n{req.context.get('summary','')[:2000]}"})
    msgs += req.messages[-8:]
    return msgs

def _guess_source_url(path: str | None, ref: str | None = None) -> str | None:
    try:
        base = (os.getenv("RAG_REPO_WEB", "") or "").strip()
        if not base or not path:
            return None
        ref = ref or os.getenv("RAG_REPO_REF", "main") or "main"
        return f"{base.rstrip('/')}/blob/{ref}/{str(path).lstrip('/')}"
    except Exception:
        return None

def _is_affirmative(text: str | None) -> bool:
    try:
        t = (text or "").strip().lower()
        if not t:
            return False
        # common single/two-word affirmatives
        YES = {
            "yes", "y", "yep", "yeah", "ya", "sure", "please", "ok", "okay",
            "affirmative", "do it", "go ahead", "sounds good", "let's do it", "pls"
        }
        # normalize punctuation
        t2 = t.replace("!", "").replace(".", "")
        if t2 in YES:
            return True
        # allow leading politeness
        for p in ("yes,", "sure,", "okay,", "ok,"):
            if t2.startswith(p):
                return True
        # simple heuristics
        return any(kw in t2 for kw in ["yes", "yep", "yeah", "sure", "ok", "okay", "please"])
    except Exception:
        return False

def _topic_from_messages(messages: list[dict]) -> str | None:
    """Extract a coarse topic (project name) from recent user messages."""
    try:
        user_texts = [m.get("content", "") for m in messages if m.get("role") == "user"]
        joined = "\n".join(user_texts).lower()
        if "ledgermind" in joined:
            return "LedgerMind"
        if "datapipe" in joined:
            return "DataPipe AI"
        if "clarity" in joined:
            return "Clarity Companion"
    except Exception:
        pass
    return None

def _assistant_offered_case_study(messages: list[dict]) -> bool:
    try:
        last_assistant = next((m for m in reversed(messages) if m.get("role") == "assistant"), None)
        if not last_assistant:
            return False
        c = str(last_assistant.get("content") or "").lower()
        return ("case study" in c) or ("60-sec demo" in c) or ("60‑sec demo" in c)
    except Exception:
        return False

def _ledger_mind_case_study_snippet() -> str:
    return (
        "LedgerMind — quick overview\n\n"
        "An offline-first personal finance agent that runs a local open model (e.g., GPT-OSS 20B via Ollama).\n\n"
        "Backend: FastAPI + Postgres with secure SSE streaming and deterministic tools for transactions, categories, and analytics.\n\n"
        "Frontend: React + Vite + Tailwind with a guarded assistant UI (grounding badge, follow-up tone checks).\n\n"
        "Security/ops: Docker Compose, Nginx (SSE-friendly), strict CSP, and encryption via GCP KMS; optional Cloudflare Tunnel for exposure.\n\n"
        "Why it’s relevant: demonstrates end-to-end AI engineering (tool orchestration + retrieval), production-ready UX, and security-minded deployment.\n\n"
        "Case study (snapshot)\n\n"
        "Problem: Personal finance tools feel opaque and slow to adapt to individual patterns.\n\n"
        "Approach: Combine a local LLM with deterministic analytics tools and a retrieval layer so explanations cite your own data and docs.\n\n"
        "What you’ll see: category trends, recurring spend, merchant insights, and explain-why answers grounded in your data.\n\n"
        "Tech focus: local inference + API tools + strict streaming/security—built to be portable across devices/environments.\n\n"
        "Would you like the full case-study write-up or a 60-sec demo?"
    )

@app.post("/chat")
async def chat(req: ChatReq):
    messages = _build_messages(req)
    # auto-RAG: peek at latest user message
    user_last = next((m for m in reversed(messages) if m.get("role") == "user"), None)
    sources: list[dict] = []
    grounded = False
    # Always attempt retrieval on JSON path; harmless if empty
    if user_last:
        try:
            matches = await fetch_context(user_last.get("content", ""), k=5)
        except Exception:
            matches = []
        if matches:
            try:
                messages = [build_context_message(matches)] + messages
            except Exception:
                pass
            # capture sources for response/meta
            for m in matches or []:
                path = m.get("path") or ""
                sid = m.get("id") or ""
                title = (m.get("title") or (_ospath.basename(path) if path else "") or sid or "Untitled")
                url = _guess_source_url(path, m.get("ref"))
                src: dict = {"title": title, "id": sid, "path": path}
                if url:
                    src["url"] = url
                sources.append(src)
            grounded = len(sources) > 0
    def _ensure_followup_question(data: dict) -> dict:
        try:
            c = data.get("choices", [{}])[0].get("message", {}).get("content")
            def _has_qmark(txt: str) -> bool:
                return ("?" in txt) or ("？" in txt) or any('?' in (line or '') for line in (txt.split('\n')))
            if isinstance(c, list):
                combined = "".join([str(x) for x in c])
                if not _has_qmark(combined):
                    c.append(" Would you like the case study?")
            elif isinstance(c, str):
                if not _has_qmark(c):
                    data["choices"][0]["message"]["content"] = c.rstrip() + " — Would you like the case study?"
        except Exception:
            pass
        return data

    try:
        # Special handling: if assistant offered a case study and user said "yes", deliver concise case-study now
        if _assistant_offered_case_study(messages) and _is_affirmative((user_last or {}).get("content")):
            topic = _topic_from_messages(messages) or "LedgerMind"
            # currently only specialized snippet for LedgerMind; others fall back to generic wording
            if topic == "LedgerMind":
                content = _ledger_mind_case_study_snippet()
            else:
                content = (
                    f"{topic} — quick overview and case study coming right up. "
                    "I’ll highlight value, stack, and results based on repo sources. "
                    "Would you like the full write-up or a 60-sec demo?"
                )
            data = {
                "id": "case-study-inline",
                "object": "chat.completion",
                "choices": [{"index":0, "message": {"role":"assistant", "content": content}, "finish_reason":"stop"}],
                "usage": {"prompt_tokens": 0, "completion_tokens": len(content.split()), "total_tokens": 0},
            }
            tag = "case-study"
        else:
            # Allow tests to bypass real LLM calls
            if os.getenv("DEV_ALLOW_NO_LLM") in {"1","true","TRUE","yes","on"}:
                # If we have sources, produce a minimal grounded response; else an ungrounded safe line.
                asked = (user_last or {}).get("content", "") if isinstance(user_last, dict) else ""
                mention = "LedgerMind — " if "ledgermind" in (asked or "").lower() else ""
                content = (
                    f"{mention}Here’s a concise overview based on repo sources. Would you like the case study?"
                    if sources
                    else "Here’s a quick overview based on the site. Want the case study or a 60-sec demo?"
                )
                data = {
                    "id": "test-synth",
                    "object": "chat.completion",
                    "choices": [{"index":0, "message": {"role":"assistant", "content": content}, "finish_reason":"stop"}],
                    "usage": {"prompt_tokens": 0, "completion_tokens": len(content.split()), "total_tokens": 0},
                }
                tag = "test"
            else:
                tag, resp = await llm_chat(messages, stream=False)
                data = resp.json()

        # Attach grounding signals (JSON path)
        try:
            data["grounded"] = bool(grounded)
            # Include sources in JSON when available to allow UI badge without SSE meta
            if sources:
                data["sources"] = sources
            # If ungrounded and the query is about LedgerMind (or other project), avoid fabricated specifics
            if not grounded and isinstance(user_last, dict) and isinstance(data.get("choices", [{}])[0].get("message", {}).get("content"), str):
                txt = (user_last.get("content") or "").lower()
                if "ledgermind" in txt:
                    data["choices"][0]["message"]["content"] = (
                        "I can share a precise overview of LedgerMind once I have the case study or a few specifics "
                        "(areas you’re interested in like stack or results). Would you like the case study or a 60‑sec demo?"
                    )
        except Exception:
            pass

        data = _ensure_followup_question(data)
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
        # Surface top-level content for simpler test assertions
        try:
            if not data.get("content"):
                data["content"] = data.get("choices", [{}])[0].get("message", {}).get("content")
        except Exception:
            pass
        # Lightweight telemetry for grounding/fallback tracking
        try:
            grounded_flag = bool(data.get("grounded"))
            sources_count = len(data.get("sources", []) or [])
            served_by = str(data.get("_served_by") or tag)
            fell_back = served_by == "fallback" or (os.getenv("DISABLE_PRIMARY") in {"1","true","TRUE","yes","on"})
            print(json.dumps({
                "evt": "chat_reply",
                "grounded": grounded_flag,
                "sources_count": sources_count,
                "served_by": served_by,
                "fell_back": bool(fell_back)
            }))
        except Exception:
            pass
        # Attach lightweight stage metrics snapshot for frontend badge/tests
        try:
            data["backends"] = stage_snapshot()
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
    # Precompute grounding for SSE meta
    user_last = next((m for m in reversed(messages) if m.get("role") == "user"), None)
    sources: list[dict] = []
    grounded = False
    if user_last and needs_repo_context(user_last.get("content", "")):
        try:
            matches = await fetch_context(user_last["content"])
            for m in matches or []:
                path = m.get("path") or ""
                sid = m.get("id") or ""
                title = (m.get("title") or (_ospath.basename(path) if path else "") or sid or "Untitled")
                url = _guess_source_url(path, m.get("ref"))
                src: dict = {"title": title, "id": sid, "path": path}
                if url:
                    src["url"] = url
                sources.append(src)
            grounded = len(sources) > 0
        except Exception:
            grounded = False

    async def gen():
        # Increment live SSE connection count
        try:
            sse_inc()
        except Exception:
            pass
        # Immediate heartbeat to help frontend extend grace window even if model is warming
        try:
            yield ":\n\n"
        except Exception:
            pass
        source = None
        got_first = False
        # Iterate with timeout to emit pings while waiting for the first token
        aiter = llm_chat_stream(messages).__aiter__()
        import asyncio as _asyncio
        while True:
            try:
                tag, line = await _asyncio.wait_for(aiter.__anext__(), timeout=0.9)
            except _asyncio.TimeoutError:
                if not got_first:
                    # keepalive ping
                    yield "event: ping\ndata: 0\n\n"
                    continue
                else:
                    # after first token, no need to ping; continue waiting
                    continue
            except StopAsyncIteration:
                break

            if source is None:
                source = tag
                try:
                    import time as _t
                    LAST_SERVED_BY["provider"] = tag
                    LAST_SERVED_BY["ts"] = _t.time()
                except Exception:
                    pass
                meta = {"_served_by": source, "grounded": bool(grounded)}
                if req.include_sources:
                    meta["sources"] = sources
                yield f"event: meta\ndata: {json.dumps(meta)}\n\n"
                # One-line telemetry when meta is first emitted
                try:
                    fell_back = source == "fallback" or (os.getenv("DISABLE_PRIMARY") in {"1","true","TRUE","yes","on"})
                    print(json.dumps({
                        "evt": "chat_stream_meta",
                        "grounded": bool(grounded),
                        "sources_count": len(sources),
                        "served_by": source,
                        "fell_back": bool(fell_back)
                    }))
                except Exception:
                    pass

            # ensure data prefix
            if not line.startswith("data:"):
                line = f"data: {line}"

            # Skip empty delta chunks occasionally emitted by backends
            try:
                payload = line.split("data:", 1)[1].strip()
                j = json.loads(payload)
                delta = j.get("choices", [{}])[0].get("delta", {}).get("content", "")
                if not delta:
                    # also allow 'content' at top-level, otherwise skip
                    if not j.get("content"):
                        continue
                else:
                    got_first = True
            except Exception:
                # Non-JSON or other shapes; treat as progress
                got_first = True

            yield line + "\n"
        yield "event: done\ndata: {}\n\n"
        # Decrement on normal completion
        try:
            sse_dec()
        except Exception:
            pass

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )

@app.post("/api/rag/ingest")
@app.post("/rag/ingest")
async def trigger_ingest(body: dict | None = None):
    try:
        result = await ingest(body or {})
        return result
    except Exception as e:
        # Return structured error to aid quick diagnosis
        return {"ok": False, "error": str(e), "hint": "Try dry_run=true or type=fs mode. You can also set reset=true once to clear broken state."}







