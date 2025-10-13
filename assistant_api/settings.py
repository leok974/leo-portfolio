"""Centralized environment settings for assistant_api.

Moves inline parsing logic (CORS, domain-derived origins, flags) into a
single import location so tests and other modules can reference the
same normalized view without duplicating parsing rules.
"""

from __future__ import annotations

import os
import urllib.parse
from functools import lru_cache
from typing import Any, Dict


def _split_env_list(val: str) -> list[str]:
    out: list[str] = []
    for token in val.replace("\n", ",").replace(" ", ",").split(","):
        t = token.strip()
        if t:
            out.append(t)
    return out


@lru_cache(maxsize=1)
def get_settings() -> dict[str, Any]:
    from .util.testmode import is_test_mode

    raw_origins = os.getenv("ALLOWED_ORIGINS", "")
    origins_tokens = _split_env_list(raw_origins)

    domain = os.getenv("DOMAIN", "").strip().rstrip("/")
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
            candidates.extend(
                [f"{scheme}://www.{base_host}", f"http://www.{base_host}"]
            )
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

    # RAG_DB: Use in-memory DB for tests if not explicitly set
    rag_db = os.getenv("RAG_DB")
    if not rag_db and is_test_mode():
        import tempfile

        tf = tempfile.NamedTemporaryFile(
            prefix="ragdb-test-", suffix=".sqlite", delete=False
        )
        rag_db = tf.name
        tf.close()
        # Force-set the env var so tests that read os.getenv() directly still get a value
        os.environ["RAG_DB"] = rag_db
    elif not rag_db:
        rag_db = "./data/rag.sqlite"

    return {
        "raw_env": raw_origins,
        "allow_all": allow_all,
        "allowed_origins": origins,
        "derived_from_domain": derived,
        "domain_env": domain,
        "RAG_DB": rag_db,
        "ARTIFACTS_DIR": os.getenv("ARTIFACTS_DIR", "./agent_artifacts"),
        "WEB_ROOT": os.getenv("WEB_ROOT", "./dist"),
        "BACKEND_URL": os.getenv("BACKEND_URL", "http://127.0.0.1:8001"),
        "SEO_CTR_THRESHOLD": float(os.getenv("SEO_CTR_THRESHOLD", "0.02")),
        # SEO LLM settings (reuse existing OPENAI_* and FALLBACK_* envs)
        "SEO_LLM_ENABLED": os.getenv("SEO_LLM_ENABLED", "1")
        in {"1", "true", "TRUE", "yes", "on"},
        "SEO_LLM_TIMEOUT": float(os.getenv("SEO_LLM_TIMEOUT", "9.0")),
        "OPENAI_BASE_URL": os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:11434/v1"),
        "OPENAI_MODEL": os.getenv("OPENAI_MODEL", "qwen2.5:7b-instruct"),
        "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", None),
        "FALLBACK_BASE_URL": os.getenv("FALLBACK_BASE_URL", ""),
        "FALLBACK_MODEL": os.getenv("FALLBACK_MODEL", "gpt-4o-mini"),
        "FALLBACK_API_KEY": os.getenv("FALLBACK_API_KEY", None),
        # Dev authentication bypass (for local testing)
        "ALLOW_DEV_AUTH": os.getenv("ALLOW_DEV_AUTH", "1")
        in {"1", "true", "TRUE", "yes", "on"},
        "DEV_BEARER_TOKEN": os.getenv("DEV_BEARER_TOKEN", "dev"),
        # Test routes (mock endpoints for fast E2E tests)
        "ALLOW_TEST_ROUTES": os.getenv("ALLOW_TEST_ROUTES", "1")
        in {"1", "true", "TRUE", "yes", "on"},
        # Dev routes (open file endpoints for viewing HTML)
        "ALLOW_DEV_ROUTES": os.getenv("ALLOW_DEV_ROUTES", "0")
        in {"1", "true", "TRUE", "yes", "on"},
        # SEO JSON-LD settings
        "SEO_LD_ENABLED": os.getenv("SEO_LD_ENABLED", "1")
        in {"1", "true", "TRUE", "yes", "on"},
        "SEO_LD_VALIDATE_STRICT": os.getenv("SEO_LD_VALIDATE_STRICT", "1")
        in {"1", "true", "TRUE", "yes", "on"},
        "SEO_LD_TYPES": os.getenv(
            "SEO_LD_TYPES",
            "WebSite,WebPage,BreadcrumbList,Person,Organization,CreativeWork,Article,VideoObject,ImageObject",
        ),
        "ARTIFACTS_ROOT": os.getenv("ARTIFACTS_ROOT", "agent/artifacts"),
        "SERP_ARTIFACTS_DIR": os.getenv("SERP_ARTIFACTS_DIR", "seo-serp"),
        # Google Search Console settings
        "GSC_PROPERTY": os.getenv(
            "GSC_PROPERTY", ""
        ),  # e.g. "https://leok974.github.io/leo-portfolio/"
        "GSC_SA_JSON": os.getenv(
            "GSC_SA_JSON", ""
        ),  # base64/JSON string of service account (optional)
        "GSC_SA_FILE": os.getenv(
            "GSC_SA_FILE", ""
        ),  # path to SA json on disk (optional)
        "REWRITE_ENDPOINT": os.getenv(
            "REWRITE_ENDPOINT", ""
        ),  # optional: POST endpoint to trigger seo.rewrite jobs
        # Brand/Person settings for JSON-LD
        "BRAND_NAME": os.getenv("BRAND_NAME", "Leo Klemet — SiteAgent"),
        "BRAND_URL": os.getenv("BRAND_URL", "https://assistant.ledger-mind.org"),
        "BRAND_LOGO": os.getenv(
            "BRAND_LOGO", "https://assistant.ledger-mind.org/assets/logo.png"
        ),
        "PERSON_NAME": os.getenv("PERSON_NAME", "Leo Klemet"),
        "PERSON_SAME_AS": os.getenv("PERSON_SAME_AS", ""),
        # Analytics / Learning settings
        "ANALYTICS_ENABLED": os.getenv("ANALYTICS_ENABLED", "1")
        in {"1", "true", "TRUE", "yes", "on"},
        "ANALYTICS_ORIGIN_ALLOWLIST": _split_env_list(
            os.getenv("ANALYTICS_ORIGIN_ALLOWLIST", "")
        ),
        "LEARNING_EPSILON": float(os.getenv("LEARNING_EPSILON", "0.10")),
        "LEARNING_DECAY": float(os.getenv("LEARNING_DECAY", "0.98")),
        "LEARNING_EMA_ALPHA": float(os.getenv("LEARNING_EMA_ALPHA", "0.30")),
        "LAYOUT_SECTIONS_DEFAULT": _split_env_list(
            os.getenv("LAYOUT_SECTIONS_DEFAULT", "hero,projects,skills,about,contact")
        ),
        "ANALYTICS_DIR": os.getenv("ANALYTICS_DIR", "./data/analytics"),
        # --- Analytics retention/archival ---
        "ANALYTICS_RETENTION_DAYS": int(
            os.getenv("ANALYTICS_RETENTION_DAYS", "90")
        ),  # delete events older than this
        "ANALYTICS_GZIP_AFTER_DAYS": int(
            os.getenv("ANALYTICS_GZIP_AFTER_DAYS", "7")
        ),  # gzip raw jsonl after this age
        "ANALYTICS_ARCHIVE_DIR": os.getenv(
            "ANALYTICS_ARCHIVE_DIR", "./data/analytics/archive"
        ),  # optional future use
        # --- Dev/Privileged access for metrics dashboard ---
        "METRICS_DEV_TOKEN": os.getenv(
            "METRICS_DEV_TOKEN"
        ),  # set a long random string in prod
        "METRICS_ALLOW_LOCALHOST": os.getenv("METRICS_ALLOW_LOCALHOST", "1")
        in {
            "1",
            "true",
            "TRUE",
            "yes",
            "on",
        },  # allow 127.0.0.1 without token during local dev
        # --- Optional Enhancements ---
        "GEOIP_DB_PATH": os.getenv(
            "GEOIP_DB_PATH"
        ),  # e.g., "./geo/GeoLite2-Country.mmdb"
        "LOG_IP_ENABLED": os.getenv("LOG_IP_ENABLED", "0")
        in {"1", "true", "TRUE", "yes", "on"},
        "METRICS_EXPORT_MAX_DAYS": int(os.getenv("METRICS_EXPORT_MAX_DAYS", "60")),
        "EMAIL_FROM": os.getenv("EMAIL_FROM"),
        "EMAIL_TO": os.getenv("EMAIL_TO"),
        "SENDGRID_API_KEY": os.getenv("SENDGRID_API_KEY"),
        # --- SEO validation tool commands (overridable via env) ---
        "SEO_GUARDRAILS_CMD": os.getenv(
            "SEO_GUARDRAILS_CMD", "node ./scripts/seo-meta-guardrails.mjs --out json"
        ),
        "LIGHTHOUSE_BATCH_CMD": os.getenv(
            "LIGHTHOUSE_BATCH_CMD",
            "node ./scripts/lighthouse-batch.mjs --sitemap sitemap.xml --format json",
        ),
        "SEO_VALIDATE_TIMEOUT_SECS": int(os.getenv("SEO_VALIDATE_TIMEOUT_SECS", "300")),
        # --- Code Review (static analysis / diff-aware) ---
        "CODE_REVIEW_CMD": os.getenv(
            "CODE_REVIEW_CMD",
            "node ./scripts/code-review.mjs --diff HEAD~1..HEAD --out json",
        ),
        "CODE_REVIEW_TIMEOUT_SECS": int(os.getenv("CODE_REVIEW_TIMEOUT_SECS", "240")),
        # --- DX Integrations (storybook/docs/stubs health) ---
        "DX_INTEGRATE_CMD": os.getenv(
            "DX_INTEGRATE_CMD", "node ./scripts/dx-integrate.mjs --check --out json"
        ),
        "DX_INTEGRATE_TIMEOUT_SECS": int(os.getenv("DX_INTEGRATE_TIMEOUT_SECS", "240")),
        # --- Infra Scale (docker/k8s dry-run) ---
        "INFRA_SCALE_CMD": os.getenv(
            "INFRA_SCALE_CMD", "node ./scripts/infra-scale.mjs --plan --out json"
        ),
        "INFRA_SCALE_TIMEOUT_SECS": int(os.getenv("INFRA_SCALE_TIMEOUT_SECS", "300")),
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
ANALYTICS_PERSIST: bool = os.getenv("ANALYTICS_PERSIST", "0") == "0"
ANALYTICS_RESPECT_DNT: bool = os.getenv("ANALYTICS_RESPECT_DNT", "1") == "1"


def reset_settings_cache() -> None:
    """Call from tests after monkeypatching env to ensure fresh Settings."""
    try:
        get_settings.cache_clear()
    except Exception:
        pass
