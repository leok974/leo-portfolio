from __future__ import annotations
import json
import os
from collections import Counter, deque
from datetime import datetime
from pathlib import Path
from typing import Deque

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status

from assistant_api.models.metrics import (
    BehaviorEvent,
    BehaviorSnapshot,
    BehaviorAggBucket,
    EventIngestResult,
)

router = APIRouter(prefix="/api/metrics", tags=["metrics"])

# Simple ring buffer for quick snapshots (avoids hitting disk for GETs)
_RING_CAPACITY = int(os.getenv("METRICS_RING_CAPACITY", "500"))
_ring: Deque[BehaviorEvent] = deque(maxlen=_RING_CAPACITY)

# Server-side sampling (0.0 to 1.0)
_SAMPLE = float(os.getenv("METRICS_SAMPLE_RATE", "1.0"))

# JSONL sink (append-only). Keep small, rotate externally if needed.
_SINK_PATH = Path(os.getenv("METRICS_JSONL", "./data/metrics.jsonl")).resolve()
_SINK_PATH.parent.mkdir(parents=True, exist_ok=True)


def _serialize_event(ev: BehaviorEvent) -> str:
    d = ev.dict()
    # ensure ISO timestamp
    d["timestamp"] = ev.timestamp.replace(tzinfo=None).isoformat() + "Z"
    return json.dumps(d, ensure_ascii=False)


@router.post("/event", response_model=EventIngestResult, status_code=202)
async def ingest_event(
    payload: BehaviorEvent,
    user_agent: str | None = Header(default=None, alias="user-agent"),
):
    import random

    # Attach UA if not provided by client
    if payload.user_agent is None and user_agent:
        payload.user_agent = user_agent[:256]

    # Server-side sampling
    if random.random() >= _SAMPLE:
        _ring.append(payload)  # still show in-memory occasionally
        return EventIngestResult(ok=True, stored=0, file=str(_SINK_PATH))

    # Append to in-memory ring for quick debug views
    _ring.append(payload)

    # Append to JSONL sink
    try:
        with _SINK_PATH.open("a", encoding="utf-8") as f:
            f.write(_serialize_event(payload) + "\n")
    except OSError as e:
        # Keep in-memory path working even if disk fails
        raise HTTPException(status_code=500, detail=f"metrics_sink_write_failed: {e}")

    return EventIngestResult(ok=True, stored=1, file=str(_SINK_PATH))


@router.get("/behavior", response_model=BehaviorSnapshot)
async def behavior_snapshot(limit: int = Query(50, ge=1, le=_RING_CAPACITY)):
    # Take a snapshot without mutating the ring
    events = list(_ring)[-limit:]
    counter = Counter(e.event for e in events)

    by_event = [BehaviorAggBucket(event=k, count=v) for k, v in counter.most_common()]

    file_size = None
    try:
        file_size = _SINK_PATH.stat().st_size
    except OSError:
        pass

    return BehaviorSnapshot(
        total=len(_ring),
        by_event=by_event,
        last_events=events[::-1],  # newest first
        file_size_bytes=file_size,
    )


@router.get("/behavior/health")
async def behavior_health():
    """Lightweight health for the metrics subsystem."""
    exists = _SINK_PATH.exists()
    return {"ok": True, "ring_capacity": _RING_CAPACITY, "sink_exists": exists}
