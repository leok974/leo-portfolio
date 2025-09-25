import os, time, httpx
from .metrics import record

PRIMARY_BASE  = os.getenv("OPENAI_BASE_URL", "http://localhost:11434/v1")
PRIMARY_KEY   = os.getenv("OPENAI_API_KEY_OLLAMA", "ollama")
PRIMARY_MODEL = os.getenv("OPENAI_MODEL", "gpt-oss:20b")  # your local model

FALLBACK_BASE = os.getenv("FALLBACK_BASE_URL", "https://api.openai.com/v1")

def _read_secret(*candidates: tuple[str, str]) -> str | None:
    """Read the first available secret from (ENV, FILE_ENV) candidate pairs."""
    for env_name, file_env in candidates:
        v = os.getenv(env_name)
        if v:
            return v
        f = os.getenv(file_env)
        if f and os.path.exists(f):
            try:
                return open(f, "r", encoding="utf-8").read().strip()
            except Exception:
                continue
    return None

def _get_fallback_key() -> str | None:
    # Accept either FALLBACK_API_KEY or OPENAI_API_KEY or their *_FILE variants
    return _read_secret(("FALLBACK_API_KEY", "FALLBACK_API_KEY_FILE"), ("OPENAI_API_KEY", "OPENAI_API_KEY_FILE"))
FALLBACK_MODEL = os.getenv("FALLBACK_MODEL", "gpt-4o-mini")

TIMEOUT=15.0

def diag() -> dict:
    """Return runtime config for debugging (no secrets)."""
    return {
        "primary_base": PRIMARY_BASE,
        "primary_model": PRIMARY_MODEL,
        "fallback_base": FALLBACK_BASE,
        "fallback_model": FALLBACK_MODEL,
        "has_fallback_key": bool(_get_fallback_key()),
    }

async def chat(messages, stream=False):
    payload = {"model": PRIMARY_MODEL, "messages": messages, "stream": stream}
    t0 = time.perf_counter()
    disable_primary = os.getenv("DISABLE_PRIMARY", "").lower() in ("1", "true", "yes")
    try:
        if not disable_primary:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                r = await client.post(
                    f"{PRIMARY_BASE}/chat/completions",
                    headers={"Authorization": f"Bearer {PRIMARY_KEY}"},
                    json=payload,
                )
                if r.status_code == 404:
                    # endpoint missing on primary (e.g., Ollama no OpenAI-compatible route) -> try fallback
                    raise httpx.HTTPStatusError("Not Found", request=r.request, response=r)
                r.raise_for_status()
                record(r.status_code, (time.perf_counter()-t0)*1000, provider="primary")
                return ("primary", r)
        else:
            raise RuntimeError("Primary disabled via DISABLE_PRIMARY")
    except Exception as e_primary:
        FALLBACK_KEY = _get_fallback_key()
        try:
            print("llm_client: primary failed, will fallback? key=", bool(FALLBACK_KEY))
        except Exception:
            pass
        if not FALLBACK_KEY:
            # re-raise the original primary error
            raise e_primary
        payload["model"] = FALLBACK_MODEL
        t1 = time.perf_counter()
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            try:
                print("llm_client: calling OpenAI fallback", FALLBACK_BASE)
            except Exception:
                pass
            r = await client.post(
                f"{FALLBACK_BASE}/chat/completions",
                headers={"Authorization": f"Bearer {FALLBACK_KEY}"},
                json=payload,
            )
            try:
                r.raise_for_status()
            except Exception:
                try:
                    print("fallback_error_status:", r.status_code)
                    print((r.text or "")[:400])
                except Exception:
                    pass
                raise
            in_toks = out_toks = 0
            try:
                u = r.json().get("usage", {})
                in_toks, out_toks = int(u.get("prompt_tokens",0)), int(u.get("completion_tokens",0))
            except Exception:
                pass
            record(r.status_code, (time.perf_counter()-t1)*1000, provider="fallback",
                   in_toks=in_toks, out_toks=out_toks)
            return ("fallback", r)

async def chat_stream(messages):
    payload = {"model": PRIMARY_MODEL, "messages": messages, "stream": True}
    # Try primary (Ollama via OpenAI-compatible API)
    disable_primary = os.getenv("DISABLE_PRIMARY", "").lower() in ("1", "true", "yes")
    try:
        if not disable_primary:
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
        else:
            raise RuntimeError("Primary disabled via DISABLE_PRIMARY")
    except Exception:
        pass
    # Fallback to OpenAI
    payload["model"] = FALLBACK_MODEL
    FALLBACK_KEY = _get_fallback_key()
    if not FALLBACK_KEY:
        # Without a fallback key, stop here
        return
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









