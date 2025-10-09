from fastapi import APIRouter, Depends, Request, HTTPException
from pathlib import Path
import json
from collections import defaultdict
from datetime import datetime, timedelta, UTC

from ..settings import get_settings
from ..models.metrics import MetricIngestRequest
from ..services.analytics_store import AnalyticsStore
from ..services.behavior_learning import analyze, order_sections

router = APIRouter(prefix="/agent", tags=["agent"])


def get_store():
    settings = get_settings()
    return AnalyticsStore(settings["ANALYTICS_DIR"])


@router.post("/metrics/ingest")
async def ingest(
    req: Request,
    payload: MetricIngestRequest,
    store: AnalyticsStore = Depends(get_store),
):
    settings = get_settings()
    if not settings["ANALYTICS_ENABLED"]:
        raise HTTPException(status_code=403, detail="analytics_disabled")
    origin = req.headers.get("origin")
    allowlist = settings["ANALYTICS_ORIGIN_ALLOWLIST"]
    if allowlist and origin not in allowlist:
        raise HTTPException(status_code=403, detail="origin_not_allowed")
    store.append_jsonl([e.model_dump() for e in payload.events])
    return {"ok": True, "count": len(payload.events)}


@router.post("/analyze/behavior")
async def analyze_behavior(store: AnalyticsStore = Depends(get_store)):
    settings = get_settings()
    files = sorted(Path(store.dir).glob("events-*.jsonl"))[-14:]
    events = []
    for p in files:
        with p.open() as f:
            for line in f:
                try:
                    events.append(json.loads(line))
                except Exception:
                    continue
    prev = store.load_weights()
    weights = analyze(
        events,
        prev,
        settings["LAYOUT_SECTIONS_DEFAULT"],
        settings["LEARNING_EMA_ALPHA"],
        settings["LEARNING_DECAY"],
    )
    store.save_weights(weights)
    ordered = order_sections(
        weights, settings["LEARNING_EPSILON"], settings["LAYOUT_SECTIONS_DEFAULT"]
    )
    return {
        "updated": weights["updated_at"],
        "weights": weights["sections"],
        "order": ordered,
    }


@router.get("/layout")
async def get_layout(store: AnalyticsStore = Depends(get_store)):
    settings = get_settings()
    weights = store.load_weights()
    ordered = order_sections(weights, 0.0, settings["LAYOUT_SECTIONS_DEFAULT"])
    return {"order": ordered, "weights": weights.get("sections", {})}


@router.get("/metrics/summary")
async def metrics_summary(store: AnalyticsStore = Depends(get_store)):
    """Aggregated 14d summary for dashboard: per-section views/clicks/dwell/CTR."""
    settings = get_settings()
    files = sorted(Path(store.dir).glob("events-*.jsonl"))[-14:]
    counts_view = defaultdict(int)
    counts_click = defaultdict(int)
    dwell_ms = defaultdict(int)

    cutoff = datetime.now(UTC) - timedelta(days=14)
    total_events = 0
    for p in files:
        with p.open() as f:
            for line in f:
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                ts = e.get("ts")
                if isinstance(ts, str):
                    try:
                        ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    except Exception:
                        continue
                if not ts or ts < cutoff:
                    continue
                s = e.get("section")
                et = e.get("event_type")
                if not s or not et:
                    continue
                total_events += 1
                if et == "view":
                    counts_view[s] += 1
                if et == "click":
                    counts_click[s] += 1
                if et == "dwell":
                    dwell_ms[s] += int(e.get("dwell_ms") or 0)

    weights = store.load_weights().get("sections", {})
    sections = sorted(
        set(settings["LAYOUT_SECTIONS_DEFAULT"])
        | set(counts_view)
        | set(counts_click)
        | set(dwell_ms)
    )
    rows = []
    for s in sections:
        v = counts_view[s]
        c = counts_click[s]
        d = dwell_ms[s]
        ctr = (c / v) if v else 0.0
        avg_dwell = (d / v) if v else 0.0
        rows.append(
            {
                "section": s,
                "views": v,
                "clicks": c,
                "ctr": ctr,
                "avg_dwell_ms": round(avg_dwell, 2),
                "weight": weights.get(s, {}).get("weight", 0.5),
            }
        )
    # sort by weight desc for convenience
    rows.sort(key=lambda r: -r["weight"])
    return {
        "total_events": total_events,
        "updated": datetime.now(UTC).isoformat(),
        "rows": rows,
    }

