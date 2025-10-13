"""A/B testing router for layout optimization."""

from typing import Optional

from fastapi import APIRouter, Header, Query

from ..services import ab_store
from ..services.layout_ab import (
    assign_bucket,
    record_event,
    reset_metrics,
    suggest_weights,
)

router = APIRouter(prefix="/agent/ab", tags=["ab-testing"])


@router.get("/assign")
def ab_assign(
    visitor_id: str | None = None,
    x_visitor_id: str | None = Header(None, alias="X-Visitor-Id"),
):
    """
    Assign visitor to A or B bucket.

    Args:
        visitor_id: Optional visitor ID query parameter
        x_visitor_id: Optional visitor ID from X-Visitor-Id header

    Returns:
        Dict with assigned bucket
    """
    # Prefer query param over header
    vid = visitor_id or x_visitor_id
    return {"bucket": assign_bucket(vid)}


@router.post("/event/{bucket}/{event}")
def ab_event(bucket: str, event: str):
    """
    Record an event for a bucket.

    Args:
        bucket: "A" or "B"
        event: "view" or "click"

    Returns:
        Updated state dict
    """
    result = record_event(bucket, event)  # existing counters
    ab_store.append_event(bucket, event)  # new JSONL log
    return result


@router.get("/suggest")
def ab_suggest():
    """
    Get weight adjustment suggestions based on A/B test results.

    Returns:
        Dict with better bucket, CTRs, and weight hints
    """
    return suggest_weights()


@router.post("/reset")
def ab_reset():
    """
    Reset A/B testing metrics.

    Returns:
        Reset state dict
    """
    return reset_metrics()


@router.get("/summary")
def ab_summary(
    frm: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
):
    """
    Get aggregated A/B testing analytics.

    Args:
        frm: Start date (YYYY-MM-DD), inclusive
        to: End date (YYYY-MM-DD), inclusive

    Returns:
        Dict with daily series and overall stats
    """
    return ab_store.summary(from_day=frm, to_day=to)
