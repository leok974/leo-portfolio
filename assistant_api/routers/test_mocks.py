"""
Test-only mock endpoints for E2E testing.
Enabled with ALLOW_TEST_ROUTES=1 or VITE_E2E=1.
"""
import os
from fastapi import APIRouter, Response

router = APIRouter(prefix="/api/test", tags=["test-mocks"])

def _enabled() -> bool:
    """Check if test routes should be enabled."""
    return os.getenv("ALLOW_TEST_ROUTES") == "1" or os.getenv("VITE_E2E") == "1"

@router.get("/ready")
def ready():
    """Health check for test environment."""
    if not _enabled():
        return Response(status_code=404)
    return {"ok": True}

@router.get("/agent/ab/suggest")
def ab_suggest():
    """Mock AB testing suggestion endpoint."""
    if not _enabled():
        return Response(status_code=404)
    return {
        "status": "ok",
        "better": "A",
        "ctr_a": 0.042,
        "ctr_b": 0.038,
        "winners": [{"id": "home.hero-A", "uplift_pct": 3.8}],
        "variants": [
            {"id": "home.hero-A", "weight": 0.6},
            {"id": "home.hero-B", "weight": 0.4}
        ],
    }

@router.get("/agent/ab/summary")
def ab_summary():
    """Mock AB testing summary endpoint."""
    if not _enabled():
        return Response(status_code=404)
    return {
        "status": "ok",
        "series": [
            {"day": "2025-10-06", "A_ctr": 0.042, "B_ctr": 0.038, "A_views": 1000, "A_clicks": 42, "B_views": 950, "B_clicks": 36},
            {"day": "2025-10-07", "A_ctr": 0.045, "B_ctr": 0.041, "A_views": 1100, "A_clicks": 50, "B_views": 1050, "B_clicks": 43},
            {"day": "2025-10-08", "A_ctr": 0.051, "B_ctr": 0.044, "A_views": 1200, "A_clicks": 61, "B_views": 1150, "B_clicks": 51},
        ],
        "overall": {
            "A_ctr": 0.046,
            "B_ctr": 0.041,
            "A": {"views": 3300, "clicks": 153},
            "B": {"views": 3150, "clicks": 130},
            "days": 3,
        },
    }

@router.get("/agent/ab/metrics")
def ab_metrics():
    """Mock AB testing metrics endpoint."""
    if not _enabled():
        return Response(status_code=404)
    return {
        "status": "ok",
        "series": [
            {"date": "2025-10-07", "ctr": 0.045, "conversions": 42},
            {"date": "2025-10-08", "ctr": 0.051, "conversions": 48}
        ]
    }
