from fastapi import APIRouter
import os, httpx
from urllib.parse import urlparse

router = APIRouter(prefix="/llm", tags=["llm"])

@router.get("/health")
async def llm_health():
    status = {"ollama": "down", "openai": "not_configured"}
    # Ollama
    try:
        host = os.getenv("OLLAMA_HOST")
        port_env = os.getenv("OLLAMA_PORT")
        port = int(port_env) if port_env else None
        base = os.getenv("OPENAI_BASE_URL", "")
        if base:
            u = urlparse(base)
            # u.netloc may be 'host:port'
            if u.hostname:
                host = host or u.hostname
            if u.port:
                port = port or u.port
        host = host or "localhost"
        port = port or 11434
        async with httpx.AsyncClient(timeout=3) as x:
            r = await x.get(f"http://{host}:{port}/api/version")
            status["ollama"] = "up" if r.status_code == 200 else f"err:{r.status_code}"
    except Exception:
        pass
    # OpenAI key presence
    if os.getenv("OPENAI_API_KEY"):
        status["openai"] = "configured"
    return {"ok": True, "status": status}
