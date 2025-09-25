import os, httpx, json, time
from .metrics import record

PRIMARY_BASE = os.getenv("OPENAI_BASE_URL", "http://localhost:11434/v1")
PRIMARY_KEY = os.getenv("OPENAI_API_KEY_OLLAMA", "ollama")
PRIMARY_MODEL = os.getenv("OPENAI_MODEL", "gpt-oss:20b")

FALLBACK_BASE = os.getenv("FALLBACK_BASE_URL", "https://api.openai.com/v1")

def _read_secret(env_name: str, file_env: str, default_file: str | None = None) -> str | None:
    val = os.getenv(env_name)
    if val:
        return val
    fpath = os.getenv(file_env) or default_file
    if fpath and os.path.exists(fpath):
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                return f.read().strip()
        except Exception:
            return None
    return None

OPENAI_API_KEY = _read_secret("OPENAI_API_KEY", "OPENAI_API_KEY_FILE", "/run/secrets/openai_api_key")
FALLBACK_KEY = _read_secret("FALLBACK_API_KEY", "FALLBACK_API_KEY_FILE", "/run/secrets/fallback_api_key") or OPENAI_API_KEY
FALLBACK_MODEL = os.getenv("FALLBACK_MODEL", "gpt-4o")

TIMEOUT = float(os.getenv("LLM_TIMEOUT", "15"))

async def chat(messages, stream=False):
    payload = {"model": PRIMARY_MODEL, "messages": messages, "stream": stream}
    headers = {"Authorization": f"Bearer {PRIMARY_KEY}"}
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(f"{PRIMARY_BASE}/chat/completions", headers=headers, json=payload)
            r.raise_for_status()
            dt = (time.perf_counter() - t0) * 1000
            # Ollama often lacks usage; record provider only
            record(r.status_code, dt, provider="primary")
            return ("primary", r)
    except Exception:
        # Fallback to OpenAI
        payload["model"] = FALLBACK_MODEL
        headers = {"Authorization": f"Bearer {FALLBACK_KEY}"}
        t1 = time.perf_counter()
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(f"{FALLBACK_BASE}/chat/completions", headers=headers, json=payload)
            r.raise_for_status()
            dt = (time.perf_counter() - t1) * 1000
            in_toks = out_toks = 0
            try:
                u = r.json().get("usage", {})
                in_toks = int(u.get("prompt_tokens", 0))
                out_toks = int(u.get("completion_tokens", 0))
            except Exception:
                pass
            record(r.status_code, dt, provider="fallback", in_toks=in_toks, out_toks=out_toks)
            return ("fallback", r)

async def chat_stream(messages):
    payload = {"model": PRIMARY_MODEL, "messages": messages, "stream": True}
    # Try primary (Ollama via OpenAI-compatible API)
    try:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{PRIMARY_BASE}/chat/completions",
                headers={"Authorization": f"Bearer {PRIMARY_KEY}"},
                json=payload,
            ) as r:
                r.raise_for_status()
                # emit no tokens for stream; log provider at start
                record(r.status_code, 0.0, provider="primary")
                async for line in r.aiter_lines():
                    if not line:
                        continue
                    yield ("primary", line)
                return
    except Exception:
        pass
    # Fallback to OpenAI
    payload["model"] = FALLBACK_MODEL
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST",
            f"{FALLBACK_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {FALLBACK_KEY}"},
            json=payload,
        ) as r:
            r.raise_for_status()
            record(r.status_code, 0.0, provider="fallback")
            async for line in r.aiter_lines():
                if not line:
                    continue
                yield ("fallback", line)









