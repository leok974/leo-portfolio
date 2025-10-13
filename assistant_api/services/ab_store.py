"""
A/B Testing Event Store

Stores view/click events in JSONL format with daily aggregation for analytics.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import time
from collections.abc import Iterable
from typing import Any, Dict, Literal

DATA_DIR = pathlib.Path("data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
EVENTS = DATA_DIR / "ab_events.jsonl"


def _ts() -> int:
    """Current Unix timestamp."""
    return int(time.time())


def _daykey(ts: int) -> str:
    """Convert timestamp to YYYY-MM-DD string."""
    return dt.datetime.fromtimestamp(ts).strftime("%Y-%m-%d")


def append_event(
    bucket: Literal["A", "B"],
    event: Literal["view", "click"],
    ts: int | None = None
):
    """Append an event to the JSONL log."""
    ts = ts or _ts()
    EVENTS.parent.mkdir(parents=True, exist_ok=True)
    with EVENTS.open("a", encoding="utf-8") as f:
        f.write(
            json.dumps({
                "ts": ts,
                "day": _daykey(ts),
                "bucket": bucket,
                "event": event
            }) + "\n"
        )


def iter_events() -> Iterable[dict[str, Any]]:
    """Iterate over all events in the log."""
    if not EVENTS.exists():
        return []
    with EVENTS.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except Exception:
                continue


def summary(from_day: str | None = None, to_day: str | None = None) -> dict[str, Any]:
    """
    Aggregate daily CTR per bucket + totals.

    Args:
        from_day: Start date (YYYY-MM-DD), inclusive
        to_day: End date (YYYY-MM-DD), inclusive

    Returns:
        {
            "series": [{"day": "2025-01-15", "A_ctr": 0.15, "B_ctr": 0.12, ...}],
            "overall": {"A_ctr": 0.14, "B_ctr": 0.11, "A": {...}, "B": {...}}
        }
    """
    daily: dict[str, dict[str, dict[str, int]]] = {}  # day -> bucket -> counts
    totals = {"A": {"views": 0, "clicks": 0}, "B": {"views": 0, "clicks": 0}}

    for e in iter_events():
        d = e["day"]
        if from_day and d < from_day:
            continue
        if to_day and d > to_day:
            continue

        b = e["bucket"]
        ev = e["event"]

        # Initialize day if needed
        daily.setdefault(d, {
            "A": {"views": 0, "clicks": 0},
            "B": {"views": 0, "clicks": 0}
        })

        # Increment counts
        if ev == "view":
            daily[d][b]["views"] += 1
            totals[b]["views"] += 1
        else:  # click
            daily[d][b]["clicks"] += 1
            totals[b]["clicks"] += 1

    # Build time series
    days_sorted = sorted(daily.keys())
    series = []
    for d in days_sorted:
        a = daily[d]["A"]
        b = daily[d]["B"]
        ctrA = (a["clicks"] / a["views"]) if a["views"] else 0.0
        ctrB = (b["clicks"] / b["views"]) if b["views"] else 0.0
        series.append({
            "day": d,
            "A_views": a["views"],
            "A_clicks": a["clicks"],
            "A_ctr": ctrA,
            "B_views": b["views"],
            "B_clicks": b["clicks"],
            "B_ctr": ctrB
        })

    # Overall stats
    overall = {
        "A_ctr": (totals["A"]["clicks"] / totals["A"]["views"]) if totals["A"]["views"] else 0.0,
        "B_ctr": (totals["B"]["clicks"] / totals["B"]["views"]) if totals["B"]["views"] else 0.0,
        "A": totals["A"],
        "B": totals["B"],
        "days": len(days_sorted)
    }

    return {"series": series, "overall": overall}
