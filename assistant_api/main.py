from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests, os

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
    allow_headers=["Content-Type", "X-API-Key"],
)

class ChatReq(BaseModel):
    messages: list  # [{role:"system|user|assistant", content:"..."}]
    context: dict | None = None  # optional (projects snippet)
    stream: bool = False

SYSTEM_PROMPT = """You are Leo’s portfolio assistant.
Be concise, friendly, and specific. Primary goals:
1) Recommend which project to view based on the question (LedgerMind, DataPipe AI, Clarity Companion).
2) Provide one-sentence value prop + 3 bullets (tech/impact/why-it’s-hireable).
3) Offer actions: “View GitHub”, “Case Study”, “Quick View”, “Schedule a call”.
Only answer about Leo’s work; don’t invent facts. If unsure, say so briefly.
Always end with one line of actions like:
[Case Study](/#projects) • [LedgerMind GitHub](https://github.com/leok974/ai-finance-agent-oss) • [Schedule a call](https://calendly.com/leo-klemet/30min)
"""

def clamp_tokens(n: int, lo=64, hi=4096):  # crude guard
    return max(lo, min(hi, n))

@app.post("/chat")
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
        "stream": False  # keep simple; easy to flip to True later
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
