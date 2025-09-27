import os
import os.path
import httpx
from .db import connect, index_dim
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
from .keys import is_openai_configured


def _llm_path(ollama_state: str | None, primary_present: bool, openai_state: str | None) -> str:
    if ollama_state == 'up':
        return 'primary' if primary_present else 'warming'
    if openai_state == 'configured':
        return 'fallback'
    return 'down'


async def build_status(base: str) -> dict:
    async with httpx.AsyncClient(timeout=3.0) as client:
        try:
            ready_probe = (await client.get(f"{base}/ready")).status_code == 200
        except Exception:
            ready_probe = False

        llm_status: dict = {}
        primary_model = OPENAI_MODEL
        try:
            health_resp = await client.get(f"{base}/llm/health")
            if health_resp.status_code == 200:
                health_json = health_resp.json()
                if isinstance(health_json, dict):
                    llm_status = health_json.get('status', {}) or {}
                    primary_model = health_json.get('primary_model', OPENAI_MODEL)
        except Exception:
            llm_status = {}

        # --- RAG health (prefer direct) ---
        rag_ok = False
        rag_mode = None
        rag_http_error = None
        rag_timeout = float(os.getenv('RAG_PROBE_TIMEOUT', '3'))
        force_http = os.getenv('STATUS_RAG_VIA_HTTP', '0') == '1'

        def _direct_rag() -> tuple[bool, str | None]:
            try:
                conn = connect()
                dim = index_dim(conn)
                if dim is None:
                    return False, None
                # Heuristic mode inference (matches embed_query logic)
                if dim in (1536, 3072):
                    mode = 'openai' if is_openai_configured() else 'local-fallback'
                elif dim in (384, 768):
                    mode = 'local-model'
                else:
                    mode = 'local-fallback'
                return True, mode
            except Exception:
                return False, None

        direct_ok, direct_mode = _direct_rag()
        rag_ok = direct_ok
        rag_mode = direct_mode

        if force_http:
            try:
                rag_resp = await client.post(
                    f"{base}/api/rag/query",
                    json={'question': 'ping', 'k': 1},
                    timeout=rag_timeout,
                )
                if rag_resp.status_code == 200:
                    try:
                        rag_json = rag_resp.json()
                    except Exception:
                        rag_json = {}
                    rag_ok = True
                    rag_mode = (rag_json.get('mode') if isinstance(rag_json, dict) else rag_mode) or rag_mode
                else:
                    rag_http_error = f"status:{rag_resp.status_code}"
            except Exception as e:
                rag_http_error = str(e)

    rag_db = os.getenv('RAG_DB', './data/rag.sqlite')
    openai_flag = is_openai_configured()

    ollama_state = llm_status.get('ollama') if isinstance(llm_status, dict) else None
    openai_state = 'configured' if openai_flag else 'not_configured'
    primary_present = bool(llm_status.get('primary_model_present')) if isinstance(llm_status, dict) else False
    llm_path = _llm_path(ollama_state, primary_present, openai_state)
    ready = (ollama_state == 'up') and primary_present and rag_ok

    llm_info = {
        'path': llm_path,
        'model': primary_model,
        'ollama': ollama_state,
        'openai': openai_state,
        'primary_model_present': primary_present,
        'ready_probe': ready_probe,
    }

    rag_info = {'ok': rag_ok, 'db': rag_db}
    if rag_mode:
        rag_info['mode'] = rag_mode
    if rag_http_error:
        rag_info['http_error'] = rag_http_error

    return {
        'llm': llm_info,
        'openai_configured': openai_flag,
        'rag': rag_info,
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
            f"RAG DB: {rag_db}. "
            f"LLM path: {llm_path}"
        ),
    }
