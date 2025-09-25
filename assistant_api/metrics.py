import time, threading
from collections import deque, defaultdict
from typing import Deque, Tuple

_lock = threading.Lock()
_events: Deque[Tuple[float, int, float, str, int, int]] = deque(maxlen=5000)  # (ts, status, ms, provider, in_toks, out_toks)
_totals = defaultdict(int)

def record(status: int, ms: float, provider: str | None = None, in_toks: int = 0, out_toks: int = 0):
    with _lock:
        prov = provider or "-"
        _events.append((time.time(), status, ms, prov, in_toks, out_toks))
        _totals["req"] += 1
        if status >= 500:
            _totals["5xx"] += 1
        if provider:
            _totals[f"by_provider:{provider}:req"] += 1
        _totals["tok:in"] += int(in_toks)
        _totals["tok:out"] += int(out_toks)

def snapshot():
    with _lock:
        latencies = [ms for _, _, ms, _, _, _ in _events]
        p95 = 0.0
        if latencies:
            s = sorted(latencies)
            idx = max(0, int(0.95 * len(s)) - 1)
            p95 = s[idx]
        providers = {k.split("by_provider:")[1].split(":")[0]: v
                     for k, v in _totals.items() if k.startswith("by_provider:")}
        return {
            "req": _totals.get("req", 0),
            "5xx": _totals.get("5xx", 0),
            "tok_in": _totals.get("tok:in", 0),
            "tok_out": _totals.get("tok:out", 0),
            "p95_ms": round(p95, 1),
            "providers": providers,
        }
