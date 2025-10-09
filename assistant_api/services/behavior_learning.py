from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Any, List
import random


def _norm(vs: Dict[str, float]) -> Dict[str, float]:
    if not vs:
        return {}
    lo, hi = min(vs.values()), max(vs.values())
    if hi == lo:
        return {k: 0.0 for k in vs}
    return {k: (v - lo) / (hi - lo) for k, v in vs.items()}


def analyze(
    events: List[dict],
    prev: Dict[str, Any],
    sections_default: List[str],
    ema_alpha=0.3,
    decay=0.98,
) -> Dict[str, Any]:
    # aggregate
    counts_view = defaultdict(int)
    counts_click = defaultdict(int)
    dwell_ms = defaultdict(int)

    cutoff = datetime.utcnow() - timedelta(days=14)
    for e in events:
        ts = e["ts"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if ts < cutoff:
            continue
        s = e["section"]
        et = e["event_type"]
        if et == "view":
            counts_view[s] += 1
        if et == "click":
            counts_click[s] += 1
        if et == "dwell":
            dwell_ms[s] += e.get("dwell_ms") or 0

    # compute metrics
    secs = set(sections_default) | set(counts_view) | set(counts_click) | set(dwell_ms)
    ctr = {s: (counts_click[s] / max(counts_view[s], 1)) for s in secs}
    avg_dwell = {s: (dwell_ms[s] / max(counts_view[s], 1)) for s in secs}

    ctr_n = _norm(ctr)
    dwell_n = _norm(avg_dwell)

    # EMA + decay
    prev_sections = prev.get("sections", {})
    new_sections = {}
    for s in secs:
        prev_w = prev_sections.get(s, {}).get("weight", 0.5)
        score_now = 0.6 * ctr_n.get(s, 0.0) + 0.4 * dwell_n.get(s, 0.0)
        ema = ema_alpha * score_now + (1 - ema_alpha) * prev_w
        new_sections[s] = {"weight": decay * ema + (1 - decay) * 0.5}

    return {
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "sections": new_sections,
    }


def order_sections(
    weights: Dict[str, Any], epsilon: float, default_order: List[str]
) -> List[str]:
    base = sorted(
        list({*default_order, *weights.get("sections", {}).keys()}),
        key=lambda s: -weights.get("sections", {}).get(s, {}).get("weight", 0.5),
    )
    if len(base) >= 2 and random.random() < epsilon:
        i, j = random.sample(range(len(base)), k=2)
        base[i], base[j] = base[j], base[i]
    return base
