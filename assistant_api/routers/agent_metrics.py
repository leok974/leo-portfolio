from fastapi import APIRouter, Depends, Request, HTTPException
from pathlib import Path
import json

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
