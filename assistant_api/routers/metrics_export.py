from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pathlib import Path
import csv, json, io, datetime as dt

router = APIRouter(prefix="/agent/metrics", tags=["agent","metrics"])

MET_JSONL = Path("agent/metrics/seo-meta-auto.jsonl")

@router.get("/seo-meta-auto.csv", summary="CSV export of nightly metrics")
def export_csv(limit_days: int = Query(90, ge=0, le=3650)):
    if not MET_JSONL.exists():
        raise HTTPException(404, "metrics JSONL not found")
    rows = []
    for line in MET_JSONL.read_text(encoding="utf-8").splitlines():
        if not line.strip(): continue
        try:
            j = json.loads(line)
        except Exception:
            continue
        if limit_days:
            try:
                ts = dt.datetime.fromisoformat(j.get("ts","").replace("Z","+00:00"))
                if (dt.datetime.now(dt.timezone.utc) - ts).days > limit_days:
                    continue
            except Exception:
                pass
        rows.append(j)
    rows.sort(key=lambda r: r.get("ts",""))
    cols = ["ts","repo","run_id","run_number","pages_count","over_count","skipped","reason","pr_number","pr_url"]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols)
    w.writeheader()
    for r in rows:
        w.writerow({k: r.get(k, "") for k in cols})
    return PlainTextResponse(buf.getvalue(), media_type="text/csv; charset=utf-8")
