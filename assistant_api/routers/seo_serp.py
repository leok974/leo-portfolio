from __future__ import annotations
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel, Field, HttpUrl
from starlette.responses import JSONResponse
import json, os, random

try:
    from assistant_api.settings import settings
except Exception:
    class _S:
        ARTIFACTS_ROOT: str = "agent/artifacts"
        SERP_ARTIFACTS_DIR: str = "seo-serp"
        GSC_PROPERTY: str = ""  # e.g., "https://leok974.github.io/leo-portfolio/"
        GSC_SA_JSON: str = ""   # optional: full JSON string of a service account
        GSC_SA_FILE: str = ""   # optional: path to service account file
        ALLOW_DEV_ROUTES: int = 1
    settings = _S()

ART_DIR = Path(settings.ARTIFACTS_ROOT).joinpath(settings.SERP_ARTIFACTS_DIR)
ART_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/agent/seo/serp", tags=["seo-serp"])

# ---------------- Models ----------------
class SerpRow(BaseModel):
    date: str
    page: HttpUrl
    clicks: int
    impressions: int
    ctr: float
    position: float

class FetchReq(BaseModel):
    start_date: Optional[str] = None  # YYYY-MM-DD
    end_date: Optional[str] = None    # YYYY-MM-DD
    property_url: Optional[str] = None
    limit: int = 200
    dry_run: bool = True

class AnalyzeReq(BaseModel):
    rows: List[SerpRow]
    min_impressions: int = 50
    low_ctr_factor: float = 0.5  # flag pages < (factor * median ctr)

class PingReq(BaseModel):
    sitemap_urls: List[HttpUrl]
    dry_run: bool = True

class RemediateReq(BaseModel):
    day: Optional[str] = None     # default: latest
    limit: int = 10               # max anomalies to act on
    dry_run: bool = True

# ---------------- Helpers ----------------
def _today_utc() -> date:
    return datetime.now(timezone.utc).date()

def _dates_from_req(req: FetchReq) -> tuple[str, str]:
    end_d = date.fromisoformat(req.end_date) if req.end_date else _today_utc()
    start_d = date.fromisoformat(req.start_date) if req.start_date else (end_d - timedelta(days=1))
    return (start_d.isoformat(), end_d.isoformat())

def _folder_for(day: str) -> Path:
    p = ART_DIR.joinpath(day)
    p.mkdir(parents=True, exist_ok=True)
    return p

def _write_jsonl(p: Path, rows: List[Dict[str, Any]]):
    with p.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

def _load_previous_day(day: str) -> List[Dict[str, Any]]:
    prev = (date.fromisoformat(day) - timedelta(days=1)).isoformat()
    f = ART_DIR.joinpath(prev, "gsc.jsonl")
    if not f.exists(): return []
    rows: List[Dict[str, Any]] = []
    with f.open("r", encoding="utf-8") as fh:
        for line in fh:
            try: rows.append(json.loads(line))
            except: pass
    return rows

def _median(values: List[float]) -> float:
    if not values: return 0.0
    v = sorted(values)
    n = len(v)
    mid = n // 2
    if n % 2: return float(v[mid])
    return float((v[mid - 1] + v[mid]) / 2.0)

# ---------------- Data sources ----------------
def _gsc_configured() -> bool:
    return bool(getattr(settings, "GSC_PROPERTY", "") and (getattr(settings, "GSC_SA_JSON", "") or getattr(settings, "GSC_SA_FILE", "")))

def _fetch_gsc_real(property_url: str, start_date: str, end_date: str, limit: int) -> List[SerpRow]:
    """
    Real Search Console fetch. Requires google-api-python-client in env and service account with Search Console access.
    This function is guarded and not executed unless configured.
    """
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"google-api-python-client not installed: {e}")

    sa_info: Dict[str, Any] = {}
    if getattr(settings, "GSC_SA_JSON", ""):
        sa_info = json.loads(settings.GSC_SA_JSON)
    elif getattr(settings, "GSC_SA_FILE", ""):
        with open(settings.GSC_SA_FILE, "r", encoding="utf-8") as f:
            sa_info = json.load(f)
    else:
        raise HTTPException(status_code=500, detail="Service account not provided")

    creds = service_account.Credentials.from_service_account_info(sa_info, scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
    svc = build("searchconsole", "v1", credentials=creds)
    body = {
        "startDate": start_date,
        "endDate": end_date,
        "dimensions": ["PAGE"],
        "rowLimit": limit,
    }
    resp = svc.searchanalytics().query(siteUrl=property_url, body=body).execute()
    rows = []
    for r in resp.get("rows", []):
        page = r["keys"][0]
        clicks = int(r.get("clicks", 0))
        impressions = int(r.get("impressions", 0))
        ctr = float(r.get("ctr", 0.0))
        pos = float(r.get("position", 0.0))
        rows.append(SerpRow(date=end_date, page=page, clicks=clicks, impressions=impressions, ctr=ctr, position=pos))
    return rows

def _fetch_gsc_mock(property_url: str, start_date: str, end_date: str, limit: int) -> List[SerpRow]:
    origin = property_url.rstrip("/")
    paths = ["/", "/projects/ledgermind", "/projects/datapipe", "/posts/agentic-portfolio"]
    rows: List[SerpRow] = []
    rnd = random.Random(42)  # stable
    for p in paths:
        imps = rnd.randint(60, 400)
        clicks = rnd.randint(int(imps*0.05), int(imps*0.25))
        ctr = clicks / imps
        pos = rnd.uniform(1.8, 18.0)
        rows.append(SerpRow(date=end_date, page=f"{origin}{p}", clicks=clicks, impressions=imps, ctr=ctr, position=pos))
    # Inject an anomaly: very low CTR on one page
    rows.append(SerpRow(date=end_date, page=f"{origin}/projects/terminality", clicks=2, impressions=500, ctr=0.004, position=35.0))
    return rows[:limit]

# ---------------- Analysis ----------------
def _analyze(rows: List[SerpRow], min_impressions: int, low_ctr_factor: float, previous_rows: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    prev_by_page: Dict[str, Dict[str, Any]] = {}
    if previous_rows:
        for r in previous_rows:
            prev_by_page[str(r.get("page"))] = r

    ctrs = [r.ctr for r in rows if r.impressions >= min_impressions]
    med_ctr = _median(ctrs)
    anomalies: List[Dict[str, Any]] = []
    for r in rows:
        if r.impressions < min_impressions: continue
        flag_low = med_ctr > 0 and r.ctr < (low_ctr_factor * med_ctr)
        delta = None
        reason = []
        if flag_low:
            reason.append(f"ctr<{low_ctr_factor}×median ({r.ctr:.3f} < {low_ctr_factor*med_ctr:.3f})")
        if prev_by_page:
            prev = prev_by_page.get(str(r.page))
            if prev and prev.get("impressions", 0) >= min_impressions:
                prev_ctr = float(prev.get("ctr") or 0.0)
                delta = r.ctr - prev_ctr
                if prev_ctr > 0 and (r.ctr < prev_ctr * low_ctr_factor):
                    reason.append(f"ctr drop vs prev ({r.ctr:.3f} < {low_ctr_factor}×{prev_ctr:.3f})")
        if reason:
            anomalies.append({
                "page": str(r.page),
                "impressions": r.impressions,
                "ctr": round(r.ctr, 4),
                "position": round(r.position, 2),
                "prev_ctr": None if not prev_by_page else float(prev_by_page.get(str(r.page),{}).get("ctr") or 0.0),
                "delta_ctr": delta,
                "reasons": reason,
                "suggestions": [
                    "Run seo.rewrite on H1/description.",
                    "Validate JSON-LD types for this route.",
                    "Check internal links/anchor text.",
                    "Consider new thumbnail/OG image test."
                ]
            })
    return {
        "median_ctr": round(med_ctr, 4),
        "total_pages": len(rows),
        "anomalies": anomalies,
    }

# ---------------- Endpoints ----------------
@router.post("/fetch")
def fetch(req: FetchReq):
    start_date, end_date = _dates_from_req(req)
    prop = req.property_url or getattr(settings, "GSC_PROPERTY", "")
    if not prop:
        # No property configured → return mock (dev convenience)
        rows = _fetch_gsc_mock("http://localhost:5173/", start_date, end_date, req.limit)
        report = {"source": "mock", "note": "GSC_PROPERTY not configured"}
    else:
        if _gsc_configured():
            rows = _fetch_gsc_real(prop, start_date, end_date, req.limit)
            report = {"source": "gsc", "property": prop}
        else:
            rows = _fetch_gsc_mock(prop, start_date, end_date, req.limit)
            report = {"source": "mock", "note": "Service account not configured"}

    day = end_date
    folder = _folder_for(day)
    artifacts = {}
    if not req.dry_run:
        data_path = folder.joinpath("gsc.jsonl")
        _write_jsonl(data_path, [r.model_dump() for r in rows])
        summary = {
            "window": {"start": start_date, "end": end_date},
            "fetched": len(rows),
            **report
        }
        folder.joinpath("summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2))
        artifacts = {"jsonl": str(data_path), "summary": str(folder.joinpath("summary.json"))}
    return JSONResponse({"rows": [r.model_dump() for r in rows], "report": report, "artifacts": artifacts})

@router.post("/analyze")
def analyze(req: AnalyzeReq):
    rows = req.rows
    # try to use previous artifacts for delta if same-day rows provided
    prev_rows = []
    if rows:
        try:
            any_day = rows[0].date
            prev_rows = _load_previous_day(any_day)
        except Exception:
            prev_rows = []
    result = _analyze(rows, req.min_impressions, req.low_ctr_factor, previous_rows=prev_rows)
    return JSONResponse(result)

@router.get("/report")
def report(day: Optional[str] = Query(None, description="YYYY-MM-DD or omit for latest")):
    # choose latest folder
    if not day:
        subdirs = [p for p in ART_DIR.iterdir() if p.is_dir()]
        if not subdirs: raise HTTPException(status_code=404, detail="No SERP artifacts")
        day = sorted([p.name for p in subdirs])[-1]
    folder = ART_DIR.joinpath(day)
    if not folder.exists(): raise HTTPException(status_code=404, detail="Day not found")
    jsonl = folder.joinpath("gsc.jsonl")
    rows: List[Dict[str, Any]] = []
    if jsonl.exists():
        for line in jsonl.read_text(encoding="utf-8").splitlines():
            try: rows.append(json.loads(line))
            except: pass
    analysis = _analyze([SerpRow(**r) for r in rows], min_impressions=50, low_ctr_factor=0.5, previous_rows=_load_previous_day(day))
    summary_path = folder.joinpath("summary.json")
    summary = json.loads(summary_path.read_text()) if summary_path.exists() else {}
    return JSONResponse({"day": day, "count": len(rows), "summary": summary, "analysis": analysis})

@router.post("/ping-sitemaps")
def ping_sitemaps(req: PingReq):
    # safe by default: dry-run true
    ping_urls = []
    for sm in req.sitemap_urls:
        ping_urls.append(f"https://www.google.com/ping?sitemap={sm}")
        ping_urls.append(f"https://www.bing.com/ping?sitemap={sm}")
    result = {"targets": ping_urls, "performed": False}
    if not req.dry_run:
        # fire-and-forget, but we still make requests in backend only if explicitly allowed
        import urllib.request
        for u in ping_urls:
            try:
                with urllib.request.urlopen(u) as _:
                    pass
            except Exception:
                pass
        result["performed"] = True
    return JSONResponse(result)

# Dev-only fixture to create artifacts with anomalies for tests/CI
if getattr(settings, "ALLOW_DEV_ROUTES", 0):
    @router.post("/mock/populate")
    def mock_populate(days: int = Body(2, embed=True)):
        prop = getattr(settings, "GSC_PROPERTY", "") or "http://localhost:5173/"
        end = _today_utc()
        for d in range(days, 0, -1):
            day = (end - timedelta(days=d)).isoformat()
            rows = _fetch_gsc_mock(prop, day, day, 200)
            folder = _folder_for(day)
            _write_jsonl(folder.joinpath("gsc.jsonl"), [r.model_dump() for r in rows])
            folder.joinpath("summary.json").write_text(json.dumps({"window":{"start":day,"end":day},"fetched":len(rows),"source":"mock"}, indent=2))
        latest = end.isoformat()
        # last day with worse CTR on one page (already in mock)
        rows = _fetch_gsc_mock(prop, latest, latest, 200)
        folder = _folder_for(latest)
        _write_jsonl(folder.joinpath("gsc.jsonl"), [r.model_dump() for r in rows])
        folder.joinpath("summary.json").write_text(json.dumps({"window":{"start":latest,"end":latest},"fetched":len(rows),"source":"mock-latest"}, indent=2))
        return {"ok": True, "days": days+1}

@router.post("/remediate")
def remediate(req: RemediateReq):
    """Create a remediation plan from latest (or specified) anomalies.
       Optionally POST each item to an external rewrite endpoint."""
    # choose day/report
    if not req.day:
        subdirs = [p for p in ART_DIR.iterdir() if p.is_dir()]
        if not subdirs: raise HTTPException(status_code=404, detail="No SERP artifacts")
        req.day = sorted([p.name for p in subdirs])[-1]
    rep = report(req.day)  # reuse existing logic
    data = rep.body if hasattr(rep, "body") else rep
    if hasattr(data, "body"): data = data.body
    analysis = data.get("analysis", {})
    anomalies = analysis.get("anomalies", [])
    plan = []
    for a in anomalies[: req.limit]:
        plan.append({
            "action": "seo.rewrite",
            "url": a["page"],
            "reason": "; ".join(a.get("reasons", [])),
            "suggestions": a.get("suggestions", []),
            "inputs": {"modes": ["title","description","h1"], "dry_run": True}
        })
    # persist plan
    folder = ART_DIR.joinpath(req.day)
    actions_path = folder.joinpath("actions.jsonl")
    _write_jsonl(actions_path, plan)
    # optional fire to external rewrite endpoint
    called = 0
    endpoint = getattr(settings, "REWRITE_ENDPOINT", "")
    if endpoint and not req.dry_run:
        import urllib.request
        for item in plan:
            payload = json.dumps({"url": item["url"], **item["inputs"]}).encode("utf-8")
            try:
                urllib.request.urlopen(urllib.request.Request(endpoint, data=payload, headers={"Content-Type":"application/json"}))
                called += 1
            except Exception:
                pass
    return JSONResponse({"day": req.day, "count": len(plan), "plan": plan, "artifacts": {"actions": str(actions_path)}, "dispatched": called})
