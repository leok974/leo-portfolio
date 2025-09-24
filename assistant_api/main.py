from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import requests, os, json

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/v1/chat/completions")
MODEL = os.getenv("MODEL", "gpt-oss:20b")

ALLOWED_ORIGINS = [
    "https://leok974.github.io",  # GitHub Pages (origin only)
    "http://localhost:5500",      # local dev server (e.g., Live Server)
    "http://127.0.0.1:5500"       # local dev server (direct IP)
]

app = FastAPI(title="Leo Portfolio Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

class ChatReq(BaseModel):
    messages: list  # [{role:"system|user|assistant", content:"..."}]
    context: dict | None = None
    stream: bool | None = True  # default to streaming

SYSTEM_PROMPT = """You are Leo’s portfolio assistant.
Be concise and specific. Recommend the most relevant project (LedgerMind, DataPipe AI, Clarity Companion),
give one-sentence value + 3 bullets (tech/impact/why hireable), then end with actions:
[Case Study] • [GitHub] • [Schedule]. If unsure, say so briefly.
"""

def _build_messages(req: ChatReq):
    msgs = [{"role":"system","content": SYSTEM_PROMPT}]
    if req.context:
        msgs.append({"role":"system","content": f"Site context:\n{req.context.get('summary','')[:2000]}"})
    msgs += req.messages[-8:]  # last 8 turns
    return msgs

def clamp_tokens(n: int, lo=64, hi=4096):  # crude guard
    return max(lo, min(hi, n))

@app.post("/chat")  # non-stream fallback (kept for compatibility)
def chat(req: ChatReq):
    body = {
        "model": MODEL,
        "messages": _build_messages(req),
        "temperature": 0.4,
        "max_tokens": 768,
        "stream": False
    }

    try:
        r = requests.post(OLLAMA_URL, json=body, timeout=120)
        r.raise_for_status()
        data = r.json()
        # OpenAI-compatible response shape
        content = data["choices"][0]["message"]["content"]
        return {"assistant": content}
    except Exception as e:
        raise HTTPException(502, f"Upstream error: {e}")

@app.post("/chat/stream")
def chat_stream(req: ChatReq):
    body = {
        "model": MODEL,
        "messages": _build_messages(req),
        "temperature": 0.4,
        "max_tokens": 768,
        "stream": True
    }
    try:
        upstream = requests.post(OLLAMA_URL, json=body, stream=True, timeout=600)
        upstream.raise_for_status()
    except Exception as e:
        raise HTTPException(502, f"Upstream error: {e}")

    def passthrough():
        # initial comment keepalive
        yield ":ok\n\n"
        for line in upstream.iter_lines(decode_unicode=True):
            if not line:
                continue
            if line.startswith("data:"):
                yield line + "\n\n"
            else:
                yield "data: " + line + "\n\n"
        # ensure termination
        yield "data: [DONE]\n\n"

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    }
    return StreamingResponse(passthrough(), media_type="text/event-stream", headers=headers)

@app.get("/health")
def health():
    return {"ok": True, "model": MODEL}
