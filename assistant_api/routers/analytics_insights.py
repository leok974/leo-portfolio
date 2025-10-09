"""
Analytics insights API router.

Phase 51.0 — Analytics Loop

Provides access to generated analytics insights and reports.
Protected by ANALYTICS_ENABLED flag.
"""
from fastapi import APIRouter, HTTPException
from pathlib import Path
from typing import Dict, Any

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/latest")
def get_latest_insight() -> Dict[str, Any]:
    """
    Get the latest analytics insight report.

    Returns:
        - status: "ok" if report exists, "pending" if not yet generated
        - markdown: Report content (if available)
        - trend: Machine-readable trend data (if available)

    **Environment Requirements:**
    - ANALYTICS_ENABLED=true (or "1")

    **Example:**
    ```bash
    curl http://localhost:8001/analytics/latest
    ```
    """
    insight_path = Path("analytics/outputs/insight-summary.md")
    trend_path = Path("analytics/outputs/trend-report.json")

    if not insight_path.exists():
        return {
            "status": "pending",
            "message": "No analytics report available yet. Run: python -m analytics.pipeline"
        }

    try:
        markdown = insight_path.read_text(encoding="utf-8")

        # Include trend data if available
        trend_data = None
        if trend_path.exists():
            import json
            trend_data = json.loads(trend_path.read_text(encoding="utf-8"))

        return {
            "status": "ok",
            "markdown": markdown,
            "trend": trend_data,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read analytics report: {str(e)}"
        )


@router.get("/health")
def analytics_health() -> Dict[str, Any]:
    """
    Check analytics system health.

    Returns information about available reports and RAG index status.
    """
    from pathlib import Path
    import json

    insight_path = Path("analytics/outputs/insight-summary.md")
    trend_path = Path("analytics/outputs/trend-report.json")
    rag_db_path = Path("analytics/rag/vector_store.sqlite")
    data_dir = Path("data/nightly")

    # Count available daily files
    daily_files = sorted(data_dir.glob("*.json")) if data_dir.exists() else []

    return {
        "status": "healthy",
        "reports": {
            "insight_available": insight_path.exists(),
            "trend_available": trend_path.exists(),
        },
        "rag": {
            "index_exists": rag_db_path.exists(),
        },
        "data": {
            "daily_files_count": len(daily_files),
            "latest_date": daily_files[-1].stem if daily_files else None,
        }
    }
