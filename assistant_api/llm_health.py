from fastapi import APIRouter
import os, httpx
from .llm_client import PRIMARY_MODEL as PRIMARY_MODEL_NAME, mark_primary_models, set_primary_model_present
from .keys import is_openai_configured

router = APIRouter(prefix="/llm", tags=["llm"])


def _ollama_tags_url() -> str:
    base = os.getenv("OPENAI_BASE_URL")
    if base and ("localhost" in base or "127.0.0.1" in base or "ollama" in base):
        root = base.replace("/v1", "")
        return f"{root}/api/tags"
    host = os.getenv("OLLAMA_HOST", "localhost")
    port = os.getenv("OLLAMA_PORT", "11434")
    return f"http://{host}:{port}/api/tags"


def _desired_model() -> str:
    return os.getenv("PRIMARY_MODEL") or os.getenv("OPENAI_MODEL") or PRIMARY_MODEL_NAME


@router.get("/health")
async def llm_health():
    status = {"ollama": "down", "openai": "not_configured", "primary_model_present": False}
    model = _desired_model()
    try:
        url = _ollama_tags_url()
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                status["ollama"] = "up"
                try:
                    payload = resp.json()
                except Exception:
                    payload = {}
                names = []
                for item in payload.get("models", []):
                    if isinstance(item, dict):
                        name = item.get("name") or item.get("model")
                        if name:
                            names.append(name)
                present = mark_primary_models(names)
                status["primary_model_present"] = bool(present)
            else:
                status["ollama"] = f"err:{resp.status_code}"
                set_primary_model_present(None)
    except Exception:
        set_primary_model_present(None)
    if is_openai_configured():
        status["openai"] = "configured"
    return {"ok": status["ollama"] == "up", "status": status, "primary_model": model}
