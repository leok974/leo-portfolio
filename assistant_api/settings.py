"""Centralized environment settings for assistant_api.

Moves inline parsing logic (CORS, domain-derived origins, flags) into a
single import location so tests and other modules can reference the
same normalized view without duplicating parsing rules.
"""
from __future__ import annotations
import os
import urllib.parse
from functools import lru_cache
from typing import List, Dict, Any


def _split_env_list(val: str) -> list[str]:
    out: list[str] = []
    for token in val.replace('\n', ',').replace(' ', ',').split(','):
        t = token.strip()
        if t:
            out.append(t)
    return out


@lru_cache(maxsize=1)
def get_settings() -> Dict[str, Any]:
    raw_origins = os.getenv("ALLOWED_ORIGINS", "")
    origins_tokens = _split_env_list(raw_origins)

    domain = os.getenv("DOMAIN", "").strip().rstrip('/')
    derived: list[str] = []
    if domain:
        if domain.startswith("http://") or domain.startswith("https://"):
            parsed = urllib.parse.urlparse(domain)
            base_host = parsed.netloc
            scheme = parsed.scheme
        else:
            base_host = domain
            scheme = "https"
        candidates = [f"{scheme}://{base_host}", f"http://{base_host}"]
        if not base_host.startswith("www."):
            candidates.extend([f"{scheme}://www.{base_host}", f"http://www.{base_host}"])
        for c in candidates:
            if c not in origins_tokens:
                derived.append(c)
                origins_tokens.append(c)

    allow_all = os.getenv("CORS_ALLOW_ALL", "0") in {"1", "true", "TRUE", "yes", "on"}
    if allow_all:
        origins: list[str] = ["*"]
    else:
        origins = origins_tokens

    if not origins:
        # Reasonable defaults for dev / tests
        origins = [
            "https://leok974.github.io",
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "http://localhost:5530",
            "http://127.0.0.1:5530",
        ]

    return {
        "raw_env": raw_origins,
        "allow_all": allow_all,
        "allowed_origins": origins,
        "derived_from_domain": derived,
        "domain_env": domain,
    }


class SettingsProxy:
    """Lightweight attribute proxy so templates/tests can do settings.allowed_origins."""
    def __getattr__(self, item: str):  # pragma: no cover - trivial passthrough
        data = get_settings()
        if item in data:
            return data[item]
        raise AttributeError(item)


settings = SettingsProxy()

# Analytics flags (feature toggles)
ANALYTICS_ENABLED: bool = os.getenv("ANALYTICS_ENABLED", "1") == "1"
ANALYTICS_PERSIST: bool = os.getenv("ANALYTICS_PERSIST", "0") == "1"
ANALYTICS_RESPECT_DNT: bool = os.getenv("ANALYTICS_RESPECT_DNT", "1") == "1"
