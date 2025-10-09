"""
Analytics events router - beacon sink for frontend analytics.
Provides no-op endpoint that returns quickly for tests.
"""
from fastapi import APIRouter, Response
from typing import Dict, Any

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post("/beacon")
def analytics_beacon(payload: Dict[str, Any]) -> Response:
    """
    No-op sink for analytics beacons.
    Returns 204 quickly to prevent frontend delays.

    In production, this could increment Prometheus counters,
    log to analytics DB, etc.
    """
    # TODO: Add Prometheus counters or logging if needed
    # Example: analytics_events_counter.labels(type=payload.get('type')).inc()

    return Response(status_code=204)
