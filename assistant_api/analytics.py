import json
import time
from datetime import datetime
from urllib.parse import urlparse

from fastapi import APIRouter, Request

from .db import get_conn
from .metrics_analytics import (
    agent_feedback,
    agent_requests,
    click_bins,
    dwell_seconds,
    frontend_errors,
    link_clicks,
    page_view_by_dow_hour,
    page_view_by_dow_hour_path,
    page_view_by_dow_hour_path_device,
    page_views,
    project_clicks,
    project_expands,
    project_hovers,
    project_plays,
    scroll_depth,
    sessions_started,
    web_vitals_lcp,
)
from .settings import ANALYTICS_ENABLED, ANALYTICS_PERSIST, ANALYTICS_RESPECT_DNT

try:
    from zoneinfo import ZoneInfo  # type: ignore
except Exception:  # py<3.9 fallback, unlikely to be used here
    ZoneInfo = None  # type: ignore
import os as _os

ANALYTICS_TZ = _os.getenv("ANALYTICS_TZ", "America/New_York")
_TZ = None
if ZoneInfo:
    try:
        _TZ = ZoneInfo(ANALYTICS_TZ)
    except Exception:
        # tzdata not installed / unknown zone on this platform
        _TZ = None

def _bucket_path(path: str) -> str:
    """
    Map arbitrary paths to a small, stable set of buckets to keep Prom labels low.
    Adjust as your site grows, but keep this list short.
    """
    p = (path or "/").lower().split("?", 1)[0]
    if len(p) > 1 and p.endswith("/"):
        p = p[:-1]
    if p == "/":
        return "root"
    seg = p.split("/", 2)[1] if p.startswith("/") else p.split("/", 1)[0]
    if seg in {"projects", "project"}:     return "projects"
    if seg in {"cases", "case", "work"}:  return "cases"
    if seg in {"blog", "posts"}:           return "blog"
    if seg in {"docs", "documentation"}:   return "docs"
    if seg in {"about"}:                     return "about"
    if seg in {"contact"}:                   return "contact"
    if seg in {"dl", "download"}:           return "downloads"
    if seg in {"api"}:                       return "api"
    if seg in {"chat", "agent"}:            return "agent"
    if "resume" in p or "cv" in p:          return "resume"
    return "other"

router = APIRouter(prefix="/analytics", tags=["analytics"])

def _is_bot(ua: str) -> str:
    ua = (ua or "").lower()
    return "1" if any(t in ua for t in ("bot","spider","crawl","preview","prerender")) else "0"

def _device(w: int) -> str:
    if w < 640: return "mobile"
    if w < 1024: return "tablet"
    return "desktop"

@router.post("/collect")
async def collect(req: Request):
    if not ANALYTICS_ENABLED:
        return {"ok": True, "disabled": True}
    if ANALYTICS_RESPECT_DNT and req.headers.get("DNT") == "1":
        return {"ok": True, "dnt": True}

    raw = await req.body()
    try:
        data = json.loads(raw or b"{}")
    except Exception:
        data = {}
    et = data.get("type", "")
    ts = float(data.get("ts") or time.time())
    ua = req.headers.get("user-agent", "")
    bot = _is_bot(ua)

    ref_host = (data.get("ref_host") or "")[:64]
    # normalize device; prefer client hint else infer from width if provided
    device = (data.get("device") or "").strip().lower()[:16]
    if device not in ("mobile", "tablet", "desktop"):
        try:
            w = int(data.get("width", 0))
        except Exception:
            w = 0
        device = _device(w) if w > 0 else "unknown"
    theme = (data.get("theme") or "")[:16]
    path = (data.get("path") or "/")[:256]
    region = req.headers.get("CF-IPCountry", "ZZ")[:4]

    if et == "page_view":
        page_views.labels(path=path, ref_host=ref_host, device=device, theme=theme, region=region, ua_is_bot=bot).inc()
        # Day-of-week / hour-of-day bucketing in configured timezone
        try:
            dt = datetime.fromtimestamp(ts, _TZ) if _TZ else datetime.fromtimestamp(ts)
            dow = str(dt.weekday())      # 0=Mon .. 6=Sun
            hour = f"{dt.hour:02d}"      # 00..23
            page_view_by_dow_hour.labels(dow=dow, hour=hour).inc()
            # Path group bucketing
            path_group = _bucket_path(path)
            page_view_by_dow_hour_path.labels(dow=dow, hour=hour, path_group=path_group).inc()
            # Device-split variant
            page_view_by_dow_hour_path_device.labels(dow=dow, hour=hour, path_group=path_group, device=device).inc()
        except Exception:
            # fail-safe: don't block analytics on TZ/parse issues
            pass
    elif et == "dwell":
        try:
            dwell_seconds.observe(max(0.0, float(data.get("seconds", 0))))
        except Exception:
            pass
    elif et == "scroll_depth":
        percent = str(int(data.get("percent", 0)))
        scroll_depth.labels(path=path, percent=percent).inc()
    elif et == "project_click":
        project_clicks.labels(project_id=(data.get("project_id") or "unknown")).inc()
    elif et == "project_hover":
        project_hovers.labels(project_id=(data.get("project_id") or "unknown")).inc()
    elif et == "project_expand":
        project_expands.labels(project_id=(data.get("project_id") or "unknown")).inc()
    elif et == "project_video_play":
        project_plays.labels(project_id=(data.get("project_id") or "unknown")).inc()
    elif et == "agent_request":
        agent_requests.labels(intent=(data.get("intent") or "unknown"), project_id=(data.get("project_id") or "unknown")).inc()
    elif et == "agent_feedback":
        agent_feedback.labels(sentiment=(data.get("sentiment") or "neutral"), intent=(data.get("intent") or "unknown")).inc()
    elif et == "frontend_error":
        frontend_errors.labels(source=(data.get("source") or "unknown")).inc()
    elif et == "click_bin":
        x = str(int(data.get("x", 0))); y = str(int(data.get("y", 0)))
        click_bins.labels(x_bin=x, y_bin=y, path=path).inc()
    elif et == "web_vitals":
        if data.get("name") == "LCP":
            try:
                web_vitals_lcp.labels(path=path).observe(float(data.get("value", 0)) / 1000.0)
            except Exception:
                pass
    elif et == "session_start":
        sessions_started.inc()
    elif et == "link_click":
        kind = (data.get("kind") or "other").lower()
        href = (data.get("href") or "").strip()
        try:
            netloc = urlparse(href).netloc.lower()
        except Exception:
            netloc = ""
        if kind not in ("github", "artstation", "resume"):
            kind = "other"
        link_clicks.labels(kind=kind, href_domain=(netloc or "unknown")).inc()

    if ANALYTICS_PERSIST and data.get("persist"):
        con = get_conn()
        with con:
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS events(
                  id INTEGER PRIMARY KEY,
                  ts REAL NOT NULL,
                  type TEXT NOT NULL,
                  path TEXT, ref_host TEXT, project_id TEXT, intent TEXT,
                  seconds REAL, ua_bot INTEGER, device TEXT, theme TEXT, region TEXT
                )
                """
            )
            con.execute(
                """INSERT INTO events(ts,type,path,ref_host,project_id,intent,seconds,ua_bot,device,theme,region)
                           VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    ts,
                    et,
                    path,
                    ref_host,
                    data.get("project_id"),
                    data.get("intent"),
                    float(data.get("seconds") or 0),
                    1 if bot == "1" else 0,
                    device,
                    theme,
                    region,
                ),
            )

    return {"ok": True}
