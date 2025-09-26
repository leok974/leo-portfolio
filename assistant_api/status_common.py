import os
import os.path
import httpx
from .llm_client import (
    PRIMARY_BASE,
    OPENAI_MODEL,
    DISABLE_PRIMARY,
    PRIMARY_MODELS,
    PRIMARY_MODEL_PRESENT,
    LAST_PRIMARY_ERROR,
    LAST_PRIMARY_STATUS,
)
from .metrics import providers, primary_fail_reason


def _openai_configured() -> bool:
    if os.getenv('OPENAI_API_KEY') or os.getenv('FALLBACK_API_KEY'):
        return True
    for env_name in ('OPENAI_API_KEY_FILE', 'FALLBACK_API_KEY_FILE'):
        fp = os.getenv(env_name)
        if fp and os.path.exists(fp):
            return True
    if os.path.exists('/run/secrets/openai_api_key'):
        return True
    return False


async def build_status(base: str) -> dict:
    async with httpx.AsyncClient(timeout=3.0) as client:
        try:
            ready = (await client.get(f"{base}/ready")).status_code == 200
        except Exception:
            ready = False

        try:
            health_resp = await client.get(f"{base}/llm/health")
            health_json = health_resp.json() if health_resp.status_code == 200 else {}
            status = health_json.get('status', {}) if isinstance(health_json, dict) else {}
            ollama = status.get('ollama')
            openai_state = status.get('openai')
            if ollama == 'up':
                llm_path = 'local'
            elif openai_state == 'configured':
                llm_path = 'fallback'
            else:
                llm_path = 'down'
        except Exception:
            llm_path = 'down'

        try:
            rag_resp = await client.post(
                f"{base}/api/rag/query",
                json={'question': 'ping', 'k': 1},
            )
            rag_ok = rag_resp.status_code == 200
        except Exception:
            rag_ok = False

    rag_db = os.getenv('RAG_DB', './data/rag.sqlite')
    openai_flag = _openai_configured()

    return {
        'llm': {'path': llm_path, 'model': OPENAI_MODEL},
        'openai_configured': openai_flag,
        'rag': {'ok': rag_ok, 'db': rag_db},
        'ready': ready,
        'primary': {
            'base_url': PRIMARY_BASE,
            'model': OPENAI_MODEL,
            'enabled': not DISABLE_PRIMARY,
            'model_present': bool(PRIMARY_MODEL_PRESENT),
            'models_sample': PRIMARY_MODELS[:8],
            'last_error': LAST_PRIMARY_ERROR,
            'last_status': LAST_PRIMARY_STATUS,
        },
        'metrics_hint': {
            'providers': dict(providers),
            'primary_fail_reason': dict(primary_fail_reason),
            'fields': ['req', '5xx', 'p95_ms', 'tok_in', 'tok_out'],
        },
        'tooltip': (
            f"Ollama/OpenAI configured: {bool(openai_flag)}. "
            f"RAG DB: {rag_db}"
        ),
    }
