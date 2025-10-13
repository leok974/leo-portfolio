import os
import urllib.parse
from datetime import UTC, datetime, timezone

from fastapi import APIRouter, Request
from pydantic import BaseModel

from ..metrics import (
    recent_latency_stats,
    recent_latency_stats_by_provider,
    stage_snapshot,
)
from ..state import LAST_SERVED_BY, SSE_CONNECTIONS
from ..status_common import build_status

router = APIRouter()

_START_TIME: float | None = None


def set_start_time(ts: float) -> None:
    global _START_TIME
    if _START_TIME is None:
        _START_TIME = ts


def _derive_allowed_origins() -> list[str]:
    """Derive allowed origins from ALLOWED_ORIGINS + DOMAIN (auto).
    DOMAIN may be bare (example.com) or include scheme. We normalize and include
    both https/http plus www variants when absent.
    """
    origins: set[str] = set()
    raw = os.getenv("ALLOWED_ORIGINS", "")
    for token in raw.replace("\n", ",").replace(" ", ",").split(","):
        t = token.strip()
        if t:
            origins.add(t)
    domain = os.getenv("DOMAIN", "").strip().rstrip("/")
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
            if c not in origins:
                origins.add(c)
    return sorted(origins)


class Status(BaseModel):
    ok: bool
    llm: dict
    openai_configured: bool
    rag: dict
    ready: bool
    metrics_hint: dict
    tooltip: str | None = None
    primary: dict | None = None
    last_served_by: dict | None = None
    build: dict | None = None  # build metadata (sha, time)


@router.get("/status/summary", response_model=Status)
async def status_summary():
    base = os.getenv("BASE_URL_PUBLIC", "http://127.0.0.1:8001")
    data = await build_status(base)
    # Enrich with transient latency + last served provider (not persisted in build_status core)
    data["latency_recent"] = recent_latency_stats()
    data["latency_recent_by_provider"] = recent_latency_stats_by_provider()
    # Shallow copy to avoid Pydantic mutation side effects
    data["last_served_by"] = dict(LAST_SERVED_BY)
    data["sse"] = {"connections": SSE_CONNECTIONS}
    return Status(**data)


# Alias under /api prefix so callers using /api/status/summary get the same response
@router.get("/api/status/summary", include_in_schema=False)
async def status_summary_api_alias():
    return await status_summary()


@router.get("/status/cors")
async def status_cors(request: Request):
    req_origin = request.headers.get("origin") or request.headers.get("Origin") or ""
    # Raw env inputs
    raw_allowed = os.getenv("ALLOWED_ORIGINS", "")
    domain_env = os.getenv("DOMAIN", "")
    allow_all = os.getenv("CORS_ALLOW_ALL", "0") in ("1", "true", "True")

    # Normalize allowed origins (explicit)
    allowed = _derive_allowed_origins()

    # Domain-derived set (explicitly list primary variants)
    derived_from_domain: list[str] = []
    if domain_env:
        base = domain_env.strip().rstrip("/")
        # include both https and http and basic www variants
        candidates = [f"https://{base}", f"http://{base}"]
        if not base.startswith("www."):
            candidates.extend([f"https://www.{base}", f"http://www.{base}"])
        derived_from_domain = candidates

    is_allowed = bool(
        allow_all or (req_origin in allowed) or (req_origin in derived_from_domain)
    )

    return {
        "raw_env": {
            "ALLOWED_ORIGINS": raw_allowed,
            "DOMAIN": domain_env,
            "CORS_ALLOW_ALL": os.getenv("CORS_ALLOW_ALL", ""),
        },
        "allow_all": allow_all,
        "allowed_origins": allowed,
        "derived_from_domain": derived_from_domain,
        "domain_env": domain_env,
        "request_origin": req_origin,
        "is_allowed": is_allowed,
        "timestamp": datetime.now(UTC).isoformat(),
    }


class Uptime(BaseModel):
    uptime_seconds: float
    start_time: float
    build: dict | None = None


@router.get("/status/uptime", response_model=Uptime)
async def status_uptime():
    import time

    now = time.time()
    # Initialize start time lazily if not set (in case lifespan hook not wired)
    global _START_TIME
    if _START_TIME is None:
        _START_TIME = now
    uptime = max(0.0, now - _START_TIME)
    build_sha = os.getenv("BUILD_SHA") or os.getenv("GIT_SHA")
    build_time = os.getenv("BUILD_TIME")
    build_meta = None
    if build_sha or build_time:
        build_meta = {"sha": build_sha, "time": build_time}
    return Uptime(uptime_seconds=uptime, start_time=_START_TIME, build=build_meta)


@router.get("/api/status/uptime", include_in_schema=False)
async def status_uptime_api_alias():
    return await status_uptime()


# ---- Lightweight stage metrics (aliases) -------------------------------------


@router.get("/api/metrics", include_in_schema=False)
async def api_metrics_json():
    """JSON stage metrics for embeddings/rerank/gen (counts, last latency, last backend).

    Alias to ensure availability under /api/ prefix regardless of app wiring order.
    """
    return {"ok": True, "metrics": stage_snapshot()}


@router.get("/api/metrics.csv", include_in_schema=False)
async def api_metrics_csv():
    snap = stage_snapshot()
    lines = ["stage,count,last_ms,last_backend"]
    for stage, m in snap.items():
        count = m.get("count", 0)
        last_ms = "" if m.get("last_ms") is None else m.get("last_ms")
        last_backend = m.get("last_backend") or ""
        lines.append(f"{stage},{count},{last_ms},{last_backend}")
    csv = "\n".join(lines) + "\n"
    from fastapi import Response

    return Response(
        content=csv,
        media_type="text/csv; charset=utf-8",
        headers={"Cache-Control": "no-store"},
    )
