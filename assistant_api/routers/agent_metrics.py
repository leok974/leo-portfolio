from fastapi import APIRouter, Depends, Request, HTTPException, Response
from fastapi.responses import StreamingResponse, HTMLResponse
from pathlib import Path
import json
import csv
import io
from collections import defaultdict
from datetime import datetime, timedelta, UTC
import ipaddress

from ..settings import get_settings
from ..models.metrics import MetricIngestRequest
from ..services.analytics_store import AnalyticsStore
from ..services.behavior_learning import analyze, order_sections
from ..security.dev_access import ensure_dev_access

try:
    import geoip2.database  # optional
except Exception:
    geoip2 = None

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
except Exception:
    canvas = None

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

    evs = []
    # Optional geo/anon IP enrichment
    reader = None
    if settings["LOG_IP_ENABLED"] and settings["GEOIP_DB_PATH"] and geoip2:
        try:
            reader = geoip2.database.Reader(settings["GEOIP_DB_PATH"])
        except Exception:
            reader = None

    client_ip = req.client.host if req.client else None
    xff = req.headers.get("x-forwarded-for")
    if xff:
        client_ip = xff.split(",")[0].strip() or client_ip

    def anonymize_ip(ip: str | None) -> tuple[str | None, str | None]:
        if not ip:
            return (None, None)
        try:
            ipobj = ipaddress.ip_address(ip)
            if ipobj.version == 4:
                # /24
                parts = ip.split(".")
                return (".".join(parts[:3]) + ".0/24", None)
            else:
                # /48
                hextets = ip.split(":")
                return (":".join(hextets[:3]) + "::/48", None)
        except Exception:
            return (None, None)

    anon_prefix, _ = anonymize_ip(client_ip) if settings["LOG_IP_ENABLED"] else (None, None)
    country = None
    if reader and client_ip:
        try:
            country = reader.country(client_ip).country.iso_code
        except Exception:
            country = None

    for e in payload.events:
        d = e.model_dump()
        if settings["LOG_IP_ENABLED"]:
            d.setdefault("anon_ip_prefix", anon_prefix)
            if country:
                d.setdefault("country", country)
        evs.append(d)

    store.append_jsonl(evs)
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


@router.get("/metrics/timeseries")
async def metrics_timeseries(
    metric: str = "ctr",
    days: int = 30,
    section: str | None = None,
    store: AnalyticsStore = Depends(get_store),
):
    """
    Returns daily time series for a metric: 'views' | 'clicks' | 'ctr' | 'avg_dwell_ms'
    Optionally filter by section.
    """
    settings = get_settings()
    days = max(1, min(days, settings["METRICS_EXPORT_MAX_DAYS"]))
    files = sorted(Path(store.dir).glob("events-*.jsonl"))[-days:]
    # Aggregate per-day per-section
    by_day = defaultdict(lambda: {"views": 0, "clicks": 0, "dwell_ms": 0})
    for p in files:
        with p.open() as f:
            for line in f:
                try:
                    e = json.loads(line)
                except:
                    continue
                if section and e.get("section") != section:
                    continue
                ts = e.get("ts")
                if isinstance(ts, str):
                    try:
                        ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    except:
                        continue
                dkey = ts.strftime("%Y-%m-%d")
                if e.get("event_type") == "view":
                    by_day[dkey]["views"] += 1
                elif e.get("event_type") == "click":
                    by_day[dkey]["clicks"] += 1
                elif e.get("event_type") == "dwell":
                    by_day[dkey]["dwell_ms"] += int(e.get("dwell_ms") or 0)
    # Build series sorted by date
    keys = sorted(by_day.keys())
    series = []
    for k in keys:
        v = by_day[k]
        ctr = (v["clicks"] / v["views"]) if v["views"] else 0.0
        avg_dwell = (v["dwell_ms"] / v["views"]) if v["views"] else 0.0
        series.append(
            {
                "date": k,
                "views": v["views"],
                "clicks": v["clicks"],
                "ctr": ctr,
                "avg_dwell_ms": round(avg_dwell, 2),
            }
        )
    return {"metric": metric, "section": section, "series": series}


@router.get("/metrics/export.csv")
async def metrics_export_csv(store: AnalyticsStore = Depends(get_store)):
    """CSV export of current 14d summary."""
    summary = await metrics_summary(store)
    buf = io.StringIO()
    w = csv.DictWriter(
        buf,
        fieldnames=["section", "views", "clicks", "ctr", "avg_dwell_ms", "weight"],
    )
    w.writeheader()
    for r in summary["rows"]:
        w.writerow(r)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.read()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="metrics-summary.csv"'},
    )


@router.get("/metrics/export.pdf")
async def metrics_export_pdf(store: AnalyticsStore = Depends(get_store)):
    """
    PDF export using ReportLab if available; otherwise 501.
    """
    if canvas is None:
        return Response(content="ReportLab not installed", status_code=501)

    summary = await metrics_summary(store)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    width, height = letter
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, height - 50, "Behavior Metrics Summary")
    c.setFont("Helvetica", 10)
    c.drawString(
        40,
        height - 68,
        f"Updated: {summary['updated']} · {summary['total_events']} events (14d)",
    )
    y = height - 96
    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, y, "Section")
    c.drawString(180, y, "Views")
    c.drawString(230, y, "Clicks")
    c.drawString(290, y, "CTR")
    c.drawString(340, y, "Avg Dwell")
    c.drawString(420, y, "Weight")
    y -= 14
    c.setFont("Helvetica", 10)
    for r in summary["rows"]:
        if y < 60:
            c.showPage()
            y = height - 60
        c.drawString(40, y, str(r["section"]))
        c.drawRightString(210, y, str(r["views"]))
        c.drawRightString(270, y, str(r["clicks"]))
        c.drawRightString(330, y, f"{r['ctr']*100:.1f}%")
        c.drawRightString(410, y, f"{round(r['avg_dwell_ms'])} ms")
        c.drawRightString(480, y, f"{r['weight']:.3f}")
        y -= 12
    c.showPage()
    c.save()
    pdf = buf.getvalue()
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="metrics-summary.pdf"'},
    )


@router.get("/metrics/ab")
async def metrics_ab(section: str, store: AnalyticsStore = Depends(get_store)):
    """Compare variants within a section: returns views/clicks/ctr/dwell by variant."""
    files = sorted(Path(store.dir).glob("events-*.jsonl"))[-14:]
    views = defaultdict(lambda: defaultdict(int))  # variant -> counts
    clicks = defaultdict(lambda: defaultdict(int))
    dwell = defaultdict(lambda: defaultdict(int))
    for p in files:
        with p.open() as f:
            for line in f:
                try:
                    e = json.loads(line)
                except:
                    continue
                if e.get("section") != section:
                    continue
                v = e.get("variant") or "default"
                et = e.get("event_type")
                if et == "view":
                    views[v]["n"] += 1
                elif et == "click":
                    clicks[v]["n"] += 1
                elif et == "dwell":
                    dwell[v]["ms"] += int(e.get("dwell_ms") or 0)
    rows = []
    variants = set(views.keys()) | set(clicks.keys()) | set(dwell.keys())
    for v in sorted(variants):
        n = views[v]["n"]
        c = clicks[v]["n"]
        ms = dwell[v]["ms"]
        rows.append(
            {
                "variant": v,
                "views": n,
                "clicks": c,
                "ctr": (c / max(n, 1)),
                "avg_dwell_ms": (ms / max(n, 1)) if n else 0.0,
            }
        )
    rows.sort(key=lambda r: -r["ctr"])
    return {"section": section, "rows": rows}


@router.get("/metrics/dashboard", response_class=HTMLResponse)
async def metrics_dashboard(
    request: Request,
    store: AnalyticsStore = Depends(get_store),
):
    """
    Serves the metrics dashboard HTML only to privileged viewers.
    Token may be provided via:
    - Authorization: Bearer <token>
    - X-Dev-Token: <token>
    - ?dev=<token>
    - Cookie: dev_token=<token>
    
    Localhost (127.0.0.1) is allowed without token when METRICS_ALLOW_LOCALHOST=true.
    """
    settings = get_settings()
    ensure_dev_access(request, settings)
    
    # Prefer repo path admin_assets/metrics.html; fallback to public/metrics.html if present
    candidates = [
        Path("admin_assets/metrics.html"),
        Path("public/metrics.html"),
    ]
    for p in candidates:
        if p.exists():
            html = p.read_text(encoding="utf-8")
            return HTMLResponse(content=html, media_type="text/html; charset=utf-8")
    
    # If file missing, emit a simple message (keeps route private)
    return HTMLResponse(
        content="<h1>Metrics Dashboard</h1><p>metrics.html not found. Make sure 'admin_assets/metrics.html' exists.</p>",
        media_type="text/html; charset=utf-8",
    )
