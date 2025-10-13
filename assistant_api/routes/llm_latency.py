import statistics
import time
from typing import Dict, List

from fastapi import APIRouter, Query

from ..llm_client import get_primary_base_url, ping_primary_once

router = APIRouter(prefix="/llm/primary", tags=["llm"])

def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    k = (len(values) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(values) - 1)
    if f == c:
        return values[f]
    return values[f] + (values[c] - values[f]) * (k - f)

@router.get("/latency")
async def primary_latency(
    count: int = Query(15, ge=1, le=200, description="Total probes (including warmup)."),
    warmup: int = Query(2, ge=0, le=50, description="Warmup probes not counted in stats."),
    timeout_ms: int = Query(500, ge=50, le=5000, description="Per-probe timeout in ms."),
) -> dict[str, object]:
    """Low-overhead latency sampling hitting the primary /models endpoint directly."""
    timeout_s = timeout_ms / 1000.0
    samples_ms: list[float] = []
    statuses: list[int] = []
    total = max(count, 1)
    for _ in range(total):
        t0 = time.perf_counter_ns()
        try:
            status = await ping_primary_once(timeout_s=timeout_s)
        except Exception:
            status = 0
        dt_ms = (time.perf_counter_ns() - t0) / 1_000_000.0
        statuses.append(status)
        samples_ms.append(dt_ms)
    eff = samples_ms[warmup:] if warmup < len(samples_ms) else []
    eff_statuses = statuses[warmup:] if warmup < len(statuses) else []
    stats = {
        "count": len(eff),
        "ok_rate": (sum(1 for s in eff_statuses if s == 200) / len(eff)) if eff else 0.0,
        "min_ms": min(eff) if eff else 0.0,
        "p50_ms": _percentile(eff, 50.0),
        "p95_ms": _percentile(eff, 95.0),
        "p99_ms": _percentile(eff, 99.0),
        "max_ms": max(eff) if eff else 0.0,
        "avg_ms": (statistics.fmean(eff) if eff else 0.0),
    }
    return {
        "target": {
            "base_url": get_primary_base_url(),
            "endpoint": "/models",
            "timeout_ms": timeout_ms,
        },
        "probes": {
            "requested": count,
            "warmup": warmup,
            "raw_statuses": statuses,
        },
        "stats": stats,
    }
