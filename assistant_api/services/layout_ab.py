"""A/B testing service for layout optimization."""
from __future__ import annotations
import json
import time
import pathlib
import random
import hashlib
from typing import Dict, Any

STATE_PATH = pathlib.Path("data/layout_ab_state.json")


def _ensure_state_dir():
    """Ensure the data directory exists."""
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)


def _load() -> Dict[str, Any]:
    """Load A/B testing state from disk."""
    _ensure_state_dir()
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {
        "weights": {"A": None, "B": None},
        "metrics": {
            "A": {"clicks": 0, "views": 0},
            "B": {"clicks": 0, "views": 0}
        },
        "last_update": 0
    }


def _save(state: Dict[str, Any]) -> Dict[str, Any]:
    """Save A/B testing state to disk."""
    _ensure_state_dir()
    STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
    return state


def assign_bucket(visitor_id: str | None = None) -> str:
    """
    Assign visitor to bucket A or B.

    Args:
        visitor_id: Optional visitor ID for consistent bucketing

    Returns:
        "A" or "B"
    """
    # Use SHA1-based deterministic bucketing if visitor_id provided
    if visitor_id:
        h = hashlib.sha1(visitor_id.encode("utf-8")).hexdigest()
        return "A" if (int(h[:8], 16) % 2 == 0) else "B"
    # Fallback to random assignment
    return "A" if random.random() < 0.5 else "B"


def record_event(bucket: str, event: str) -> Dict[str, Any]:
    """
    Record an event for a bucket.

    Args:
        bucket: "A" or "B"
        event: "view" or "click"

    Returns:
        Updated state dict
    """
    state = _load()
    metrics = state["metrics"].setdefault(bucket, {"clicks": 0, "views": 0})

    if event == "click":
        metrics["clicks"] += 1
    elif event == "view":
        metrics["views"] += 1

    state["last_update"] = int(time.time())
    return _save(state)


def suggest_weights() -> Dict[str, Any]:
    """
    Suggest weight adjustments based on CTR comparison.

    Returns:
        Dict with better bucket, CTRs, and weight adjustment hints
    """
    state = _load()
    metrics_a = state["metrics"]["A"]
    metrics_b = state["metrics"]["B"]

    # Calculate CTRs
    ctr_a = metrics_a["clicks"] / max(1, metrics_a["views"])
    ctr_b = metrics_b["clicks"] / max(1, metrics_b["views"])

    better = "A" if ctr_a >= ctr_b else "B"

    # Naive rule: if B wins, bump 'signal' & 'media' slightly; else bump 'fit' & 'freshness'
    if better == "B":
        hint = {
            "signal": +0.05,
            "media": +0.02,
            "fit": -0.03,
            "freshness": -0.04
        }
    else:
        hint = {
            "fit": +0.05,
            "freshness": +0.02,
            "signal": -0.03,
            "media": -0.04
        }

    return {
        "better": better,
        "ctr_a": round(ctr_a, 4),
        "ctr_b": round(ctr_b, 4),
        "hint": hint,
        "metrics": state["metrics"]
    }


def reset_metrics() -> Dict[str, Any]:
    """
    Reset A/B testing metrics.

    Returns:
        Reset state dict
    """
    state = {
        "weights": {"A": None, "B": None},
        "metrics": {
            "A": {"clicks": 0, "views": 0},
            "B": {"clicks": 0, "views": 0}
        },
        "last_update": int(time.time())
    }
    return _save(state)
