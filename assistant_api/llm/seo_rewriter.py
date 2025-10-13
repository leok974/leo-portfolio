# assistant_api/llm/seo_rewriter.py
from __future__ import annotations

import json
from typing import Optional, Tuple

from ..settings import get_settings
from ..tasks.seo_tune import PageMeta  # reuse dataclass

# Prefer requests if available; otherwise urllib
try:
    import requests
except Exception:  # pragma: no cover
    requests = None
    import urllib.error
    import urllib.request

_JSON_ERR = object()

def _post(url: str, headers: dict, payload: dict, timeout: float) -> tuple[int, str]:
    """
    HTTP POST helper that works with both requests and urllib.
    Returns (status_code, response_text).
    """
    if requests:
        r = requests.post(url, headers=headers, json=payload, timeout=timeout)
        return r.status_code, r.text
    else:  # urllib fallback
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.getcode(), resp.read().decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:  # pragma: no cover
            return e.code, e.read().decode("utf-8", "ignore")

def _try_chat(
    base: str,
    model: str,
    api_key: str | None,
    sys_prompt: str,
    user_prompt: str,
    timeout: float
) -> dict | None:
    """
    Attempts OpenAI-compatible /chat/completions call.
    Returns parsed JSON dict if successful, None otherwise.
    """
    url = base.rstrip("/") + "/chat/completions"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "model": model,
        "temperature": 0.2,
        "max_tokens": 320,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_prompt}
        ]
    }

    code, text = _post(url, headers, payload, timeout)
    if code < 200 or code >= 300:
        return None

    try:
        data = json.loads(text)
    except Exception:
        return None

    # OpenAI-style: choices[0].message.content -> JSON string
    try:
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)
    except Exception:
        return None

def _clamp(s: str, max_len: int) -> str:
    """Clamps string to max_len characters."""
    s = (s or "").strip()
    return s[:max_len]

def _valid_out(obj: dict) -> bool:
    """Validates that LLM output has required fields."""
    return (
        isinstance(obj, dict)
        and "title" in obj
        and "description" in obj
        and isinstance(obj["title"], str)
        and isinstance(obj["description"], str)
    )

def llm_rewrite(url: str, ctr: float, current: PageMeta) -> PageMeta | None:
    """
    Attempts LLM rewrite using primary (OPENAI_BASE_URL/MODEL) then fallback (FALLBACK_BASE_URL/MODEL).
    Returns PageMeta or None on failure.

    The caller should fallback to heuristic_rewrite() if this returns None.
    """
    settings = get_settings()

    sys_prompt = (
        "You are an SEO copywriter. Return STRICT JSON with fields {\"title\",\"description\"}. "
        "Rules: max title 70 chars; max description 155 chars; avoid clickbait; keep truthful; "
        "include clear value proposition; prefer action verbs; reflect page intent succinctly."
    )

    user_prompt = json.dumps({
        "url": url,
        "observed_ctr": round(float(ctr), 6),
        "current_title": current.title or "",
        "current_description": current.description or "",
        "constraints": {
            "title_max": 70,
            "desc_max": 155,
            "tone": "professional, confident, specific",
            "keywords_hint": ["AI", "Automation", "Agent", "Portfolio", "Project"]
        }
    }, ensure_ascii=False)

    # Try primary
    primary = _try_chat(
        base=settings["OPENAI_BASE_URL"],
        model=settings["OPENAI_MODEL"],
        api_key=settings.get("OPENAI_API_KEY", None),  # often not needed for Ollama proxy
        sys_prompt=sys_prompt,
        user_prompt=user_prompt,
        timeout=float(settings.get("SEO_LLM_TIMEOUT", 9.0)),
    )
    if _valid_out(primary):
        return PageMeta(
            title=_clamp(primary["title"], 70),
            description=_clamp(primary["description"], 155)
        )

    # Try fallback
    fb = _try_chat(
        base=settings.get("FALLBACK_BASE_URL", ""),
        model=settings.get("FALLBACK_MODEL", settings["OPENAI_MODEL"]),
        api_key=settings.get("FALLBACK_API_KEY", None),
        sys_prompt=sys_prompt,
        user_prompt=user_prompt,
        timeout=float(settings.get("SEO_LLM_TIMEOUT", 9.0)),
    )
    if _valid_out(fb):
        return PageMeta(
            title=_clamp(fb["title"], 70),
            description=_clamp(fb["description"], 155)
        )

    return None  # caller will fallback to heuristic
