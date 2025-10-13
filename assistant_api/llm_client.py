import os
import time
from collections.abc import Iterable
from dataclasses import dataclass
from typing import List, Optional, Tuple

import httpx

from .metrics import primary_fail_reason, providers, record, stage_record_ms


@dataclass
class LLMHealth:  # Backwards-compatible minimal structure for tests
    ollama: str = "unknown"
    primary_model_present: bool | None = None
    openai: str = "unknown"


def llm_health() -> LLMHealth:
    """Return a best-effort health snapshot (test compatibility shim).
    Real implementation may live elsewhere; this prevents AttributeError in tests
    that monkeypatch llm_client.llm_health.
    """
    # Heuristic: derive openai configured state by presence of fallback key
    openai_state = "configured" if _get_fallback_key() else "not_configured"
    return LLMHealth(
        ollama="unknown",
        primary_model_present=PRIMARY_MODEL_PRESENT,
        openai=openai_state,
    )


def _norm_base(url: str) -> str:
    u = (url or "").rstrip("/")
    if not u.endswith("/v1"):
        u += "/v1"
    return u


PRIMARY_BASE = _norm_base(os.getenv("OPENAI_BASE_URL", "http://localhost:11434/v1"))
PRIMARY_KEY = os.getenv("OPENAI_API_KEY_OLLAMA", "ollama")
PRIMARY_MODEL = os.getenv("OPENAI_MODEL", "gpt-oss:20b")  # local model id
# Backward compatibility: expose OPENAI_MODEL symbol expected elsewhere
OPENAI_MODEL = PRIMARY_MODEL

FALLBACK_BASE = _norm_base(os.getenv("FALLBACK_BASE_URL", "https://api.openai.com/v1"))


def _read_secret(*candidates: tuple[str, str]) -> str | None:
    """Read the first available secret from (ENV, FILE_ENV) candidate pairs."""
    for env_name, file_env in candidates:
        v = os.getenv(env_name)
        if v:
            return v
        f = os.getenv(file_env)
        if f and os.path.exists(f):
            try:
                return open(f, encoding="utf-8").read().strip()
            except Exception:
                continue
    return None


def _get_fallback_key() -> str | None:
    # Accept either FALLBACK_API_KEY or OPENAI_API_KEY or their *_FILE variants
    return _read_secret(
        ("FALLBACK_API_KEY", "FALLBACK_API_KEY_FILE"),
        ("OPENAI_API_KEY", "OPENAI_API_KEY_FILE"),
    )


FALLBACK_MODEL = os.getenv("FALLBACK_MODEL", "gpt-4o-mini")

TIMEOUT = 15.0

PRIMARY_DEBUG = os.getenv("PRIMARY_DEBUG", "1").lower() in ("1", "true", "yes")
REQ_TIMEOUT_S = float(os.getenv("PRIMARY_TIMEOUT_S", "60"))

# Primary state caches ----------------------------------------------------------
PRIMARY_MODELS: list[str] = []
PRIMARY_MODEL_PRESENT: bool | None = None
LAST_PRIMARY_STATUS: int | None = None
LAST_PRIMARY_ERROR: str | None = None
DISABLE_PRIMARY = os.getenv("DISABLE_PRIMARY", "").lower() in ("1", "true", "yes")


def set_primary_model_present(value: bool | None) -> bool | None:
    global PRIMARY_MODEL_PRESENT
    PRIMARY_MODEL_PRESENT = value
    return PRIMARY_MODEL_PRESENT


def mark_primary_models(models: Iterable[str] | None) -> bool | None:
    global PRIMARY_MODELS
    if models is None:
        return set_primary_model_present(None)
    data = [m for m in models if isinstance(m, str)]
    PRIMARY_MODELS.clear()
    PRIMARY_MODELS.extend(data)
    if not data:
        return set_primary_model_present(False)
    target = (PRIMARY_MODEL or "").lower()
    for name in data:
        lowered = (name or "").lower()
        if lowered == target or lowered.startswith(target):
            return set_primary_model_present(True)
    return set_primary_model_present(False)


def diag() -> dict:
    """Return runtime config for debugging (no secrets)."""
    return {
        "primary_base": PRIMARY_BASE,
        "primary_model": PRIMARY_MODEL,
        "fallback_base": FALLBACK_BASE,
        "fallback_model": FALLBACK_MODEL,
        "has_fallback_key": bool(_get_fallback_key()),
        "primary_models_cached": PRIMARY_MODELS[:8],
        "primary_model_present": PRIMARY_MODEL_PRESENT,
        "last_primary_error": LAST_PRIMARY_ERROR,
        "last_primary_status": LAST_PRIMARY_STATUS,
        "primary_disabled": DISABLE_PRIMARY,
    }


def get_primary_base_url() -> str:
    """Return the OpenAI-compatible base URL for the primary (Ollama) runtime.
    Falls back to existing PRIMARY_BASE if override not set."""
    return os.getenv("PRIMARY_BASE_URL", PRIMARY_BASE)


async def ping_primary_once(timeout_s: float = 0.5) -> int:
    """One-off /models GET against primary base. Returns status code (200 expected).
    Raises httpx exceptions on network issues."""
    base = get_primary_base_url().rstrip("/")
    url = f"{base}/models"
    async with httpx.AsyncClient(timeout=timeout_s) as client:
        r = await client.get(url)
        return r.status_code


def get_primary_status() -> dict:
    return {
        "base_url": PRIMARY_BASE,
        "model": PRIMARY_MODEL,
        "enabled": not DISABLE_PRIMARY,
        "model_present": PRIMARY_MODEL_PRESENT,
        "last_error": LAST_PRIMARY_ERROR,
        "last_status": LAST_PRIMARY_STATUS,
    }


def get_fallback_status() -> dict:
    key = _get_fallback_key()
    return {
        "provider": "openai",
        "model": FALLBACK_MODEL,
        "key_present": bool(key),
    }


def _debug_log(msg: str):
    if PRIMARY_DEBUG:
        try:
            print(f"[primary-debug] {msg}")
        except Exception:
            pass


async def primary_list_models() -> list[str]:
    # Short-circuit when primary probing is disabled
    if DISABLE_PRIMARY:
        mark_primary_models([])
        return []
    base = get_primary_base_url()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{base}/models")
            r.raise_for_status()
            try:
                j = r.json() or {}
            except Exception:
                j = {}
            data = j.get("data") or []
            ids: list[str] = []
            if isinstance(data, list):
                for it in data:
                    if isinstance(it, dict) and isinstance(it.get("id"), str):
                        ids.append(it["id"])
            mark_primary_models(ids)
            return ids
    except Exception as e:
        _debug_log(f"list_models error: {e}")
        mark_primary_models(None)
        return []


async def list_models() -> list[str]:
    """Return available primary model IDs, or an empty list if not ready.

    Never raises; safe to call during startup/lifespan without aborting the server.
    Respects DISABLE_PRIMARY to avoid unnecessary probing when primary is disabled.
    """
    try:
        if DISABLE_PRIMARY:
            return []
        ids = await primary_list_models()
        # Normalize to strings; filter out unexpected shapes defensively
        return [str(m) for m in ids if isinstance(m, (str,))]
    except Exception as e:  # pragma: no cover - defensive
        try:
            import logging

            logging.getLogger("assistant_api.llm_client").warning(
                "list_models(): suppressed error during startup: %s", e
            )
        except Exception:
            pass
        return []


async def primary_chat(
    messages: list[dict], max_tokens: int = 64
) -> tuple[dict | None, str | None, int | None]:
    """Attempt primary. Returns (json, reason, http_status). reason None on success."""
    global LAST_PRIMARY_ERROR, LAST_PRIMARY_STATUS, PRIMARY_MODEL_PRESENT
    if DISABLE_PRIMARY:
        LAST_PRIMARY_ERROR = "disabled"
        LAST_PRIMARY_STATUS = None
        primary_fail_reason["disabled"] += 1
        return None, "disabled", None
    if PRIMARY_MODEL_PRESENT is False:
        primary_fail_reason["model_missing"] += 1
        LAST_PRIMARY_ERROR = "model_missing"
        LAST_PRIMARY_STATUS = 404
        return None, "model_missing", 404
    body = {"model": PRIMARY_MODEL, "messages": messages, "max_tokens": max_tokens}
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=REQ_TIMEOUT_S) as client:
            r = await client.post(
                f"{PRIMARY_BASE}/chat/completions",
                json=body,
                headers={"Authorization": f"Bearer {PRIMARY_KEY}"},
            )
            LAST_PRIMARY_STATUS = r.status_code
            if r.status_code >= 400:
                reason = "http_4xx" if r.status_code < 500 else "http_5xx"
                try:
                    j = r.json()
                    err = (j.get("error") or {}).get("message", "")
                    if "model" in err and "not found" in err:
                        reason = "model_missing"
                except Exception:
                    pass
                if reason == "model_missing":
                    set_primary_model_present(False)
                primary_fail_reason[reason] += 1
                LAST_PRIMARY_ERROR = reason
                _debug_log(
                    f"primary fail status={r.status_code} reason={reason} body={(r.text or '')[:200]}"
                )
                return None, reason, r.status_code
            j = r.json()
            dt = (time.perf_counter() - t0) * 1000
            record(r.status_code, dt, provider="primary")
            stage_record_ms("gen", "local", dt)
            providers["primary"] += 1
            # Reset error/status indicators on successful completion
            LAST_PRIMARY_ERROR = None
            LAST_PRIMARY_STATUS = r.status_code
            set_primary_model_present(True)
            return j, None, r.status_code
    except httpx.ReadTimeout:
        primary_fail_reason["timeout"] += 1
        LAST_PRIMARY_ERROR = "timeout"
        LAST_PRIMARY_STATUS = None
        set_primary_model_present(None)
        _debug_log("primary timeout")
        return None, "timeout", None
    except httpx.ConnectError as e:
        primary_fail_reason["connect_error"] += 1
        LAST_PRIMARY_ERROR = "connect_error"
        LAST_PRIMARY_STATUS = None
        set_primary_model_present(None)
        _debug_log(f"primary connect_error: {e}")
        return None, "connect_error", None
    except Exception as e:
        primary_fail_reason["unknown"] += 1
        LAST_PRIMARY_ERROR = f"unknown:{type(e).__name__}"
        LAST_PRIMARY_STATUS = None
        set_primary_model_present(None)
        _debug_log(f"primary unknown error: {e}")
        return None, "unknown", None


async def fallback_chat(messages: list[dict], max_tokens: int = 64) -> dict:
    FALLBACK_KEY = _get_fallback_key()
    if not FALLBACK_KEY:
        raise RuntimeError("Fallback key missing; cannot complete request")
    body = {"model": FALLBACK_MODEL, "messages": messages, "max_tokens": max_tokens}
    t0 = time.perf_counter()
    async with httpx.AsyncClient(timeout=REQ_TIMEOUT_S) as client:
        r = await client.post(
            f"{FALLBACK_BASE}/chat/completions",
            json=body,
            headers={"Authorization": f"Bearer {FALLBACK_KEY}"},
        )
        r.raise_for_status()
        in_toks = out_toks = 0
        try:
            u = r.json().get("usage", {})
            in_toks, out_toks = int(u.get("prompt_tokens", 0)), int(
                u.get("completion_tokens", 0)
            )
        except Exception:
            pass
    dt = (time.perf_counter() - t0) * 1000
    record(r.status_code, dt, provider="fallback", in_toks=in_toks, out_toks=out_toks)
    stage_record_ms("gen", "openai", dt)
    providers["fallback"] += 1
    return r.json()


async def chat(messages, stream=False):
    if stream:
        # delegate to stream implementation for backward compatibility
        async for item in chat_stream(messages):  # pragma: no cover
            return item
    j, reason, status = await primary_chat(messages, max_tokens=512)
    if j is not None:
        return ("primary", DummyResponse(j))
    # Fallback
    fj = await fallback_chat(messages, max_tokens=512)
    return ("fallback", DummyResponse(fj))


class DummyResponse:
    """Lightweight object exposing .json() to keep main code path untouched."""

    def __init__(self, data: dict):
        self._data = data
        self.status_code = 200

    def json(self):
        return self._data


async def chat_stream(messages):
    # Try primary streaming
    if not DISABLE_PRIMARY and PRIMARY_MODEL_PRESENT is not False:
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST",
                    f"{PRIMARY_BASE}/chat/completions",
                    headers={"Authorization": f"Bearer {PRIMARY_KEY}"},
                    json={"model": PRIMARY_MODEL, "messages": messages, "stream": True},
                ) as r:
                    if r.status_code >= 400:
                        _debug_log(f"primary stream status {r.status_code}")
                        reason = "http_4xx" if r.status_code < 500 else "http_5xx"
                        primary_fail_reason[reason] += 1
                        raise httpx.HTTPStatusError(
                            "stream error", request=r.request, response=r
                        )
                    record(r.status_code, 0.0, provider="primary")
                    providers["primary"] += 1
                    async for line in r.aiter_lines():
                        if not line:
                            continue
                        yield ("primary", line)
                    return
        except Exception as e:
            _debug_log(f"primary stream failed: {e}")
    # fallback
    FALLBACK_KEY = _get_fallback_key()
    if not FALLBACK_KEY:
        return
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST",
            f"{FALLBACK_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {FALLBACK_KEY}"},
            json={"model": FALLBACK_MODEL, "messages": messages, "stream": True},
        ) as r:
            r.raise_for_status()
            record(r.status_code, 0.0, provider="fallback")
            providers["fallback"] += 1
            async for line in r.aiter_lines():
                if not line:
                    continue
                yield ("fallback", line)
