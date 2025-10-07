"""A/B testing router for layout optimization."""
from fastapi import APIRouter
from ..services.layout_ab import assign_bucket, record_event, suggest_weights, reset_metrics

router = APIRouter(prefix="/agent/ab", tags=["ab-testing"])


@router.get("/assign")
def ab_assign(visitor_id: str | None = None):
    """
    Assign visitor to A or B bucket.

    Args:
        visitor_id: Optional visitor ID for consistent bucketing

    Returns:
        Dict with assigned bucket
    """
    return {"bucket": assign_bucket(visitor_id)}


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
