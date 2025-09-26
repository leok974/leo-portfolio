import time, threading
from collections import deque, defaultdict, Counter
from typing import Deque, Tuple

_lock = threading.Lock()
_events: Deque[Tuple[float, int, float, str, int, int]] = deque(maxlen=5000)  # (ts, status, ms, provider, in_toks, out_toks)
# Recent latency window (lightweight) for status summary (default ~ last 200 requests)
_recent_lat: Deque[float] = deque(maxlen=200)
_recent_lat_by_provider: dict[str, Deque[float]] = defaultdict(lambda: deque(maxlen=200))
_totals = defaultdict(int)

# New high-level counters (simple) -------------------------------------------------
# NB: We retain legacy snapshot aggregation so external API stays stable.
providers = Counter()  # overall provider request counts (primary, fallback, etc.)
primary_fail_reason = Counter()  # classification for primary failures

class RollingP95:
    """Lightweight rolling P95 window for optional per-route latencies."""
    def __init__(self, n: int = 50):
        self.n = n
        self.samples: list[float] = []
    def observe(self, v: float):
        self.samples.append(v)
        if len(self.samples) > self.n:
            self.samples = self.samples[-self.n:]
    def value(self) -> float:
        if not self.samples:
            return 0.0
        arr = sorted(self.samples)
        idx = int(0.95 * (len(arr)-1))
        return float(arr[idx])

route_p95 = defaultdict(lambda: RollingP95(50))

def record(status: int, ms: float, provider: str | None = None, in_toks: int = 0, out_toks: int = 0, route: str | None = None):
    with _lock:
        prov = provider or "-"
        _events.append((time.time(), status, ms, prov, in_toks, out_toks))
        _recent_lat.append(ms)
        _recent_lat_by_provider[prov].append(ms)
        _totals["req"] += 1
        if status >= 500:
            _totals["5xx"] += 1
        if provider:
            _totals[f"by_provider:{provider}:req"] += 1
            providers[provider] += 1  # new consolidated counter
        _totals["tok:in"] += int(in_toks)
        _totals["tok:out"] += int(out_toks)
        if route:
            try:
                route_p95[route].observe(ms)
            except Exception:
                pass

def snapshot():
    with _lock:
        latencies = [ms for _, _, ms, _, _, _ in _events]
        p95 = 0.0
        if latencies:
            s = sorted(latencies)
            idx = max(0, int(0.95 * len(s)) - 1)
            p95 = s[idx]
        providers_legacy = {k.split("by_provider:")[1].split(":")[0]: v
                            for k, v in _totals.items() if k.startswith("by_provider:")}
        # Merge legacy provider counts with new counter (favor new if drift)
        merged_providers = dict(providers_legacy)
        for k, v in providers.items():
            merged_providers[k] = v
        # Optional: expose top failure reasons (keep small)
        top_fail = dict(primary_fail_reason.most_common(8))
        return {
            "req": _totals.get("req", 0),
            "5xx": _totals.get("5xx", 0),
            "tok_in": _totals.get("tok:in", 0),
            "tok_out": _totals.get("tok:out", 0),
            "p95_ms": round(p95, 1),
            "providers": merged_providers,
            "primary_fail_reason": top_fail,
        }

def recent_latency_stats() -> dict:
    """Return rolling latency distribution for last N requests (cheap computation)."""
    with _lock:
        data = list(_recent_lat)
    if not data:
        return {"count": 0, "min_ms": 0.0, "p50_ms": 0.0, "p95_ms": 0.0, "p99_ms": 0.0, "max_ms": 0.0, "avg_ms": 0.0}
    s = sorted(data)
    def _pct(p: float):
        if not s:
            return 0.0
        k = (len(s) - 1) * (p / 100.0)
        f = int(k)
        c = min(f + 1, len(s) - 1)
        if f == c:
            return s[f]
        return s[f] + (s[c] - s[f]) * (k - f)
    import statistics as _st
    return {
        "count": len(s),
        "min_ms": s[0],
        "p50_ms": _pct(50.0),
        "p95_ms": _pct(95.0),
        "p99_ms": _pct(99.0),
        "max_ms": s[-1],
        "avg_ms": _st.fmean(s),
    }

def recent_latency_stats_by_provider() -> dict:
    """Return rolling latency stats split by provider (primary, fallback, etc.)."""
    with _lock:
        snap = {k: list(v) for k, v in _recent_lat_by_provider.items()}
    out: dict[str, dict] = {}
    import statistics as _st
    def _dist(arr: list[float]):
        if not arr:
            return {"count":0,"min_ms":0.0,"p50_ms":0.0,"p95_ms":0.0,"p99_ms":0.0,"max_ms":0.0,"avg_ms":0.0}
        s = sorted(arr)
        def _pct(p: float):
            k = (len(s) - 1) * (p / 100.0)
            f = int(k); c = min(f+1, len(s)-1)
            return s[f] if f==c else s[f] + (s[c]-s[f])*(k-f)
        return {
            "count": len(s),
            "min_ms": s[0],
            "p50_ms": _pct(50.0),
            "p95_ms": _pct(95.0),
            "p99_ms": _pct(99.0),
            "max_ms": s[-1],
            "avg_ms": _st.fmean(s),
        }
    for prov, arr in snap.items():
        if prov != "-":
            out[prov] = _dist(arr)
    return out
