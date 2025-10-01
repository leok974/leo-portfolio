from fastapi import APIRouter, Request
from pydantic import BaseModel
import os
from ..status_common import build_status
from ..metrics import recent_latency_stats, recent_latency_stats_by_provider
from ..state import LAST_SERVED_BY, SSE_CONNECTIONS
import urllib.parse

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
    for token in raw.replace("\n", ",").replace(" ", ",").split(','):
        t = token.strip()
        if t:
            origins.add(t)
    domain = os.getenv("DOMAIN", "").strip().rstrip('/')
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
            if c not in origins:
                origins.add(c)
    return sorted(origins)


class Status(BaseModel):
    llm: dict
    openai_configured: bool
    rag: dict
    ready: bool
    metrics_hint: dict
    tooltip: str | None = None
    primary: dict | None = None
    last_served_by: dict | None = None
    build: dict | None = None  # build metadata (sha, time)


@router.get('/status/summary', response_model=Status)
async def status_summary():
    base = os.getenv('BASE_URL_PUBLIC', 'http://127.0.0.1:8001')
    data = await build_status(base)
    # Enrich with transient latency + last served provider (not persisted in build_status core)
    data['latency_recent'] = recent_latency_stats()
    data['latency_recent_by_provider'] = recent_latency_stats_by_provider()
    # Shallow copy to avoid Pydantic mutation side effects
    data['last_served_by'] = dict(LAST_SERVED_BY)
    data['sse'] = {"connections": SSE_CONNECTIONS}
    return Status(**data)

# Alias under /api prefix so callers using /api/status/summary get the same response
@router.get('/api/status/summary', include_in_schema=False)
async def status_summary_api_alias():
    return await status_summary()


@router.get('/status/cors')
async def status_cors(request: Request):
    req_origin = request.headers.get('origin') or ''
    allowed = _derive_allowed_origins()
    return {
        'request_origin': req_origin,
        'allowed_origins': allowed,
        'is_allowed': req_origin in allowed,
    }


class Uptime(BaseModel):
    uptime_seconds: float
    start_time: float
    build: dict | None = None


@router.get('/status/uptime', response_model=Uptime)
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


@router.get('/api/status/uptime', include_in_schema=False)
async def status_uptime_api_alias():
    return await status_uptime()
