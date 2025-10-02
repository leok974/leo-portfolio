import os, json, asyncio, time
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse, StreamingResponse

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

async def _delay():
    try:
        ms = int(os.getenv("LATENCY_MS", "0"))
        if ms > 0:
            await asyncio.sleep(ms/1000.0)
        else:
            await asyncio.sleep(0)
    except Exception:
        await asyncio.sleep(0)

@app.get("/api/ping")
async def ping():
    await _delay()
    if os.getenv("FAIL_PING") == "1":
        raise HTTPException(status_code=503, detail="ping failed")
    return {"ok": True, "ts": int(time.time())}

@app.get("/api/ready")
async def ready():
    await _delay()
    fail = os.getenv("FAIL_READY") == "1"
    return {"ready": not fail}

@app.get("/api/status/summary")
async def summary():
    await _delay()
    rag_ok = os.getenv("FAIL_SUMMARY") != "1"
    return {
        "ready": True,
        "rag": {"ok": rag_ok},
        "llm": {"path": "/chat/stream"},
    }

@app.post("/chat")
async def chat():
    await _delay()
    if os.getenv("FAIL_CHAT") == "1":
        raise HTTPException(status_code=500, detail="chat failed")
    served_by = os.getenv("EXPECT_SERVED_BY", "mock")
    return JSONResponse({"ok": True, "_served_by": served_by, "model": "gpt-oss:20b"})

@app.get("/chat/stream")
async def chat_stream(request: Request):
    await _delay()
    if os.getenv("FAIL_SSE") == "1":
        return StreamingResponse(iter(()), media_type="text/event-stream")
    served_by = os.getenv("EXPECT_SERVED_BY", "mock")
    strict_marker = os.getenv("PLAYWRIGHT_STRICT_STREAM", "0") == "1"

    async def gen():
        payload = {"_served_by": served_by, "model": "gpt-oss:20b"}
        if strict_marker:
            payload["_strict_stream"] = True
        yield f"data: {json.dumps(payload)}\n\n"
        await asyncio.sleep(0.02)

    return StreamingResponse(gen(), media_type="text/event-stream")
