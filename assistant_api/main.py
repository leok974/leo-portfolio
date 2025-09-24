from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import requests, os, json

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/v1/chat/completions")
MODEL = os.getenv("MODEL", "gpt-oss:20b")

ALLOWED_ORIGINS = [
    "https://leok974.github.io",  # GitHub Pages
    "https://leok974.github.io/leo-portfolio/"
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
Be concise, friendly, and specific. Prioritize: LedgerMind, DataPipe AI, Clarity Companion.
Return a one-sentence value prop + 3 bullets (tech/impact/why hireable).
End with actions: [Case Study] • [GitHub] • [Schedule].
If unsure, say so briefly and suggest the most relevant project.
"""

def clamp_tokens(n: int, lo=64, hi=4096):  # crude guard
    return max(lo, min(hi, n))

@app.post("/chat")  # non-stream fallback (kept for compatibility)
def chat(req: ChatReq):
    # Build messages: system + (optional) portfolio context + user history
    msgs = [{"role":"system","content": SYSTEM_PROMPT}]
    if req.context:
        summary = req.context.get('summary','')
        if not isinstance(summary, str):
            summary = str(summary)
        msgs.append({"role":"system","content": f"Site context:\n{summary[:2000]}"})
    msgs += req.messages[-8:]  # keep last 8 turns

    body = {
        "model": MODEL,
        "messages": msgs,
        "temperature": 0.4,
        "max_tokens": clamp_tokens(768),
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
    msgs = [{"role":"system","content": SYSTEM_PROMPT}]
    if req.context:
        msgs.append({"role":"system","content": f"Site context:\n{req.context.get('summary','')[:2000]}"})
    msgs += req.messages[-8:]
    body = {"model": MODEL, "messages": msgs, "temperature": 0.4,
            "max_tokens": clamp_tokens(768), "stream": True}

    try:
        upstream = requests.post(OLLAMA_URL, json=body, stream=True, timeout=600)
        upstream.raise_for_status()
    except Exception as e:
        raise HTTPException(502, f"Upstream error: {e}")

    def to_sse():
        yield "event: open\ndata: {}\n\n"
        for raw in upstream.iter_lines(decode_unicode=True):
            if raw is None or raw == b'' or raw == '':
                continue
            if isinstance(raw, bytes):
                raw = raw.decode('utf-8', errors='ignore')
            if raw.startswith("data:"):
                payload = raw[5:].strip()
            else:
                payload = raw.strip()
            if payload == "[DONE]":
                yield "event: done\ndata: {}\n\n"
                break
            try:
                j = json.loads(payload)
                delta = j.get("choices", [{}])[0].get("delta", {}).get("content")
                if not delta:
                    delta = j.get("choices", [{}])[0].get("message", {}).get("content")
                if delta:
                    out = json.dumps({"token": delta})
                    yield f"event: message\ndata: {out}\n\n"
            except Exception:
                out = json.dumps({"token": payload})
                yield f"event: message\ndata: {out}\n\n"

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    }
    return StreamingResponse(to_sse(), media_type="text/event-stream", headers=headers)
