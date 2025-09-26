from fastapi import APIRouter
import os, httpx

router = APIRouter(prefix="/llm", tags=["llm"])

def _ollama_version_url():
    # Prefer OPENAI_BASE_URL (OpenAI-compatible endpoint), else OLLAMA_HOST/PORT, else localhost
    base = os.getenv("OPENAI_BASE_URL")
    if base and ("localhost" in base or "127.0.0.1" in base or "ollama" in base):
        return base.replace("/v1", "/api/version")
    host = os.getenv("OLLAMA_HOST", "localhost")
    port = os.getenv("OLLAMA_PORT", "11434")
    return f"http://{host}:{port}/api/version"

@router.get("/health")
async def llm_health():
    status = {"ollama": "down", "openai": "not_configured"}
    # Ollama
    try:
        url = _ollama_version_url()
        async with httpx.AsyncClient(timeout=3) as x:
            r = await x.get(url)
            status["ollama"] = "up" if r.status_code == 200 else f"err:{r.status_code}"
    except Exception:
        pass
    # OpenAI key presence
    if os.getenv("OPENAI_API_KEY"):
        status["openai"] = "configured"
    return {"ok": True, "status": status}
