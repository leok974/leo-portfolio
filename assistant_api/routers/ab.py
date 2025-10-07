"""A/B testing router for layout optimization."""
from fastapi import APIRouter, Header
from typing import Optional
from ..services.layout_ab import assign_bucket, record_event, suggest_weights, reset_metrics

router = APIRouter(prefix="/agent/ab", tags=["ab-testing"])


@router.get("/assign")
def ab_assign(
    visitor_id: Optional[str] = None,
    x_visitor_id: Optional[str] = Header(None, alias="X-Visitor-Id")
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
    return record_event(bucket, event)


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
