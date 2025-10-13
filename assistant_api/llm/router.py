# assistant_api/llm/router.py
"""Resilient LLM client with primary → fallback routing.

Tries PRIMARY_* env vars first (e.g., local Ollama), then falls back to
FALLBACK_* (e.g., OpenAI cloud) on retryable errors.
"""
from __future__ import annotations

import os
import socket
from typing import Any, Dict, List, Tuple

# OpenAI python client supports base_url
import openai  # type: ignore


def _cfg(prefix: str) -> dict:
    """Load LLM config from environment variables with given prefix."""
    return {
        "base_url": os.getenv(f"{prefix}_OPENAI_BASE_URL", "").strip() or None,
        "api_key": os.getenv(f"{prefix}_OPENAI_API_KEY", "").strip() or None,
        "model": os.getenv(f"{prefix}_OPENAI_MODEL", "").strip() or None,
        "timeout_s": float(os.getenv(f"{prefix}_OPENAI_TIMEOUT_S", "15")),
    }


PRIMARY = _cfg("PRIMARY")
FALLBACK = _cfg("FALLBACK")


def _client(base_url: str | None, api_key: str | None) -> openai.OpenAI:
    """Create OpenAI client with given base URL and API key."""
    if not api_key:
        # some local servers ignore the key but client requires a string
        api_key = "dummy"
    return openai.OpenAI(base_url=base_url, api_key=api_key)


def _is_retryable(exc: Exception) -> bool:
    """Check if exception is retryable (network/timeout/5xx errors)."""
    # network / gateway / 5xx → retry on fallback
    retryable_types = (TimeoutError, socket.timeout, ConnectionError)
    txt = str(exc).lower()
    return isinstance(exc, retryable_types) or any(
        k in txt
        for k in [
            "timeout",
            "timed out",
            "connect",
            "refused",
            "reset",
            "5xx",
            "bad gateway",
            "service unavailable",
        ]
    )


def chat_complete(
    messages: list[dict[str, Any]], temperature: float = 0.2
) -> tuple[str, str]:
    """
    Chat completion with automatic fallback.

    Returns (model_used, text). Tries PRIMARY first, then FALLBACK on retryable errors.

    Args:
        messages: OpenAI-format messages list
        temperature: Generation temperature (0.0-2.0)

    Returns:
        Tuple of (model_name, response_text)

    Raises:
        RuntimeError: If no backends configured
        Exception: Non-retryable errors from LLM calls
    """
    # 1) try primary
    if PRIMARY["model"] and PRIMARY["base_url"]:
        try:
            cli = _client(PRIMARY["base_url"], PRIMARY["api_key"])
            r = cli.chat.completions.create(
                model=PRIMARY["model"],
                messages=messages,
                temperature=temperature,
                timeout=PRIMARY["timeout_s"],
            )
            return PRIMARY["model"], (r.choices[0].message.content or "").strip()
        except Exception as e:
            if not _is_retryable(e):
                # non-retryable → bubble up
                raise

    # 2) fallback
    if FALLBACK["model"] and FALLBACK["base_url"]:
        cli = _client(FALLBACK["base_url"], FALLBACK["api_key"])
        r = cli.chat.completions.create(
            model=FALLBACK["model"],
            messages=messages,
            temperature=temperature,
            timeout=FALLBACK["timeout_s"],
        )
        return FALLBACK["model"], (r.choices[0].message.content or "").strip()

    # 3) nothing configured
    raise RuntimeError("No usable LLM backends configured (primary/fallback).")
