# assistant_api/routers/agent_analytics.py
from __future__ import annotations

from datetime import UTC, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from ..ctr_analytics.parsers import detect_and_parse
from ..ctr_analytics.schemas import IngestResult
from ..ctr_analytics.storage import CTRRow, ensure_tables, upsert_ctr_rows
from ..settings import get_settings
from ..utils.cf_access import require_cf_access

router = APIRouter(prefix="/agent/analytics", tags=["agent-analytics"])


@router.post("/ingest", response_model=IngestResult)
async def ingest_analytics(
    request: Request,
    principal: str = Depends(require_cf_access),
    settings=Depends(get_settings),
):
    """
    Ingest CTR analytics data from search console, GA4, or manual sources.

    Accepts multiple formats:
    - Internal JSON: { "source": "...", "rows": [{url, impressions, clicks}, ...] }
    - GSC API JSON: { "rows": [{ "keys": ["/path"], "clicks": n, "impressions": n }, ...] }
    - GA4 JSON: Loose mapping with dimensionValues/metricValues or simple objects
    - CSV: GSC UI export with Page, Clicks, Impressions columns

    Example internal JSON payload:
    {
        "source": "search_console",
        "rows": [
            {"url": "/projects/datapipe-ai", "impressions": 1000, "clicks": 5},
            {"url": "/projects/derma-ai", "impressions": 1200, "clicks": 12}
        ]
    }

    Example GSC CSV:
    Page,Clicks,Impressions,CTR,Position
    /,12,2200,0.54%,1.2
    /projects/siteagent,11,1850,0.59%,1.5
    """
    db_path = settings["RAG_DB"]  # reuse your SQLite; OK for CTR table
    ensure_tables(db_path)

    # Read body as text (so we can parse JSON or CSV)
    ctype = request.headers.get("content-type", "")
    raw = await request.body()
    raw_text = raw.decode("utf-8", "ignore") if raw else ""

    # Parse JSON if applicable (must parse from raw bytes, not call request.json() again)
    payload = None
    if "json" in ctype.lower() and raw_text:
        try:
            import json

            payload = json.loads(raw_text)
        except Exception:
            payload = None

    source, parsed_rows = detect_and_parse(payload, ctype, raw_text)
    if not parsed_rows:
        raise HTTPException(
            status_code=400,
            detail="No rows detected. Provide internal JSON, GSC API JSON, GA4 JSON, or GSC CSV export.",
        )

    now = datetime.now(UTC).isoformat()
    ctr_rows = []
    for r in parsed_rows:
        imp = int(r.get("impressions", 0))
        clk = int(r.get("clicks", 0))
        ctr = (clk / imp) if imp > 0 else 0.0
        ctr_rows.append(
            CTRRow(
                url=r["url"],
                impressions=imp,
                clicks=clk,
                ctr=ctr,
                last_seen=now,
                source=source,
            )
        )

    changed = upsert_ctr_rows(db_path, ctr_rows)
    return IngestResult(inserted_or_updated=changed, rows=len(ctr_rows), source=source)
