"""Public siteAgent endpoint with dual authentication (CF Access OR HMAC)."""
from fastapi import APIRouter, Request, HTTPException, Depends, Query, Response, Cookie
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import hmac
import hashlib
import os
import json
import base64
import time
from pathlib import Path
from ..agent.runner import run, DEFAULT_PLAN
from ..agent.tasks import REGISTRY
from ..agent.models import recent_runs, query_events
from ..utils.cf_access import require_cf_access
from ..agent.interpret import parse_command

router = APIRouter(prefix="/agent", tags=["agent-public"])


class RunReq(BaseModel):
    plan: Optional[List[str]] = None
    params: Optional[Dict[str, Any]] = None


class ActReq(BaseModel):
    command: str


def _verify_hmac(body_bytes: bytes, signature_header: Optional[str]) -> None:
    """Verify HMAC signature if SITEAGENT_HMAC_SECRET is set."""
    secret = os.environ.get("SITEAGENT_HMAC_SECRET")
    if not secret:
        return  # no guard enabled
    if not signature_header or not signature_header.startswith("sha256="):
        raise HTTPException(status_code=401, detail="Missing or invalid signature")
    provided = signature_header.split("=", 1)[1]
    expected = hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Signature mismatch")


async def _authorized(req: Request):
    """
    Allow execution if EITHER:
      • Cloudflare Access verification passes (service token or user JWT), OR
      • HMAC header validates (X-SiteAgent-Signature).

    Returns:
        bytes: Request body for subsequent processing
    """
    body = await req.body()

    # 1) Try CF Access (will raise HTTPException on invalid/missing JWT)
    try:
        require_cf_access(req)
        return body  # CF Access succeeded
    except HTTPException:
        pass  # Try HMAC fallback

    # 2) Fallback to HMAC check
    _verify_hmac(body, req.headers.get("X-SiteAgent-Signature"))
    return body


@router.get("/tasks")
def list_tasks():
    """List all available agent tasks (public endpoint)."""
    return {"tasks": sorted(REGISTRY.keys()), "default": DEFAULT_PLAN}


@router.post("/run")
async def run_agent(body: bytes = Depends(_authorized)):
    """Run agent with dual authentication (CF Access OR HMAC)."""
    payload = RunReq(**json.loads(body or b"{}"))
    return run(payload.plan, payload.params)


@router.get("/status")
def status():
    """Get recent agent run history (public endpoint)."""
    rows = recent_runs()
    items = [
        {
            "run_id": r[0],
            "started": r[1],
            "finished": r[2],
            "ok": int(r[3]),
            "errors": int(r[4]),
            "total": int(r[5]),
        }
        for r in rows
    ]
    return {"recent": items}


@router.get("/events")
def events(
    level: Optional[str] = Query(None, description="Filter by level (info, warn, error)"),
    run_id: Optional[str] = Query(None, description="Filter by run_id"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of events to return")
):
    """Get recent agent events with optional filtering (public endpoint)."""
    event_list = query_events(level=level, run_id=run_id, limit=limit)
    return {"events": event_list}


@router.get("/report")
def report():
    """
    Summarize key artifacts so the UI can show a compact maintenance dashboard.
    """
    base = Path("./assets/data")

    def _read(name, default):
        p = base / name
        if not p.exists():
            return default
        try:
            return json.loads(p.read_text("utf-8"))
        except Exception:
            return default

    news = _read("news.json", {"items": []})
    links = _read("link-check.json", {"checked": 0, "html_files": 0, "missing": []})
    media = _read("media-index.json", {"count": 0, "items": []})
    projects = _read("projects.json", {"projects": []})
    status_data = _read("siteAgent.json", {"ts": None, "brand": "LEO KLEMET — SITEAGENT"})
    # artifacts (optional)
    artifacts = {}
    for fn in ["link-apply.json", "link-apply.diff"]:
        p = base / fn
        if p.exists():
            try:
                st = p.stat()
                artifacts[fn] = {
                    "path": f"/assets/data/{fn}",
                    "size": int(st.st_size),
                    "mtime": int(st.st_mtime),
                }
            except Exception:
                artifacts[fn] = {"path": f"/assets/data/{fn}"}
    return {
        "brand": status_data.get("brand"),
        "status_ts": status_data.get("ts"),
        "projects": len(projects.get("projects", [])),
        "media_count": media.get("count", 0),
        "news_items": len(news.get("items", [])),
        "links_checked": links.get("checked", 0),
        "links_missing": len(links.get("missing", [])),
        "artifacts": artifacts,
        "samples": {
            "missing": links.get("missing", [])[:5],
            "news": news.get("items", [])[:5],
        },
    }


@router.get("/artifacts/{filename}")
async def get_artifact(filename: str):
    """
    Serve individual artifact files (diffs, markdown, etc).
    """
    base = Path("./assets/data")
    # Sanitize filename to prevent directory traversal
    safe_name = filename.replace("..", "").replace("/", "").replace("\\", "")
    file_path = base / safe_name
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Artifact not found: {filename}")
    
    try:
        content = file_path.read_text("utf-8")
        # Determine media type based on extension
        if safe_name.endswith(".md"):
            media_type = "text/markdown"
        elif safe_name.endswith(".diff"):
            media_type = "text/plain"
        elif safe_name.endswith(".json"):
            media_type = "application/json"
        else:
            media_type = "text/plain"
        
        return PlainTextResponse(content, media_type=media_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading artifact: {str(e)}")


@router.post("/act")
async def act(req: Request, body: bytes = Depends(_authorized)):
    """
    Natural-language agent commands.
    Interprets command string and executes corresponding plan.
    """
    payload = ActReq(**json.loads(body or b"{}"))
    plan, params = parse_command(payload.command)
    if not plan:
        raise HTTPException(status_code=400, detail="Could not interpret command")
    return run(plan, params)


# -----------------------------
# Dev overlay signed-cookie flow
# -----------------------------
def _b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def _b64u_dec(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _sign_dev(payload: Dict[str, Any], key: str) -> str:
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    sig = hmac.new(key.encode("utf-8"), raw, hashlib.sha256).digest()
    return _b64u(raw) + "." + _b64u(sig)


def _verify_dev(token: str, key: str) -> Optional[Dict[str, Any]]:
    try:
        raw_b64, sig_b64 = token.split(".", 1)
        raw = _b64u_dec(raw_b64)
        want = hmac.new(key.encode("utf-8"), raw, hashlib.sha256).digest()
        got = _b64u_dec(sig_b64)
        if not hmac.compare_digest(want, got):
            return None
        obj = json.loads(raw.decode("utf-8"))
        if int(obj.get("exp", 0)) < int(time.time()):
            return None
        return obj
    except Exception:
        return None


class DevEnableReq(BaseModel):
    hours: Optional[int] = 2


@router.get("/dev/status")
def dev_status(sa_dev: Optional[str] = Cookie(default=None)):
    """
    Returns whether the dev overlay is enabled via signed cookie.
    """
    # local dev always allowed (index.html also guards by host or ?dev=1)
    # but this endpoint reflects cookie status only.
    key = os.environ.get("SITEAGENT_DEV_COOKIE_KEY", "")
    if not key or not sa_dev:
        return {"allowed": False}
    ok = _verify_dev(sa_dev, key) is not None
    return {"allowed": ok}


@router.post("/dev/enable")
async def dev_enable(req: Request, body: bytes = Depends(_authorized)):
    """
    Set a signed cookie enabling the maintenance overlay for a short time.
    Requires auth (CF Access or HMAC). Default 2 hours.
    """
    key = os.environ.get("SITEAGENT_DEV_COOKIE_KEY", "")
    if not key:
        raise HTTPException(status_code=500, detail="SITEAGENT_DEV_COOKIE_KEY not set")
    try:
        data = json.loads(body or b"{}")
    except Exception:
        data = {}
    hours = int(data.get("hours") or 2)
    exp = int(time.time()) + max(300, min(hours, 24) * 3600)
    token = _sign_dev({"exp": exp, "v": 1}, key)
    resp = PlainTextResponse("ok")
    resp.set_cookie(
        "sa_dev",
        token,
        max_age=exp - int(time.time()),
        path="/",
        secure=True,
        httponly=True,
        samesite="lax",
    )
    return resp


@router.post("/dev/disable")
async def dev_disable(body: bytes = Depends(_authorized)):
    """
    Clear the dev overlay cookie. Requires auth.
    """
    resp = PlainTextResponse("ok")
    resp.delete_cookie("sa_dev", path="/")
    return resp


# -----------------------------
# PR Automation
# -----------------------------
class PROpenReq(BaseModel):
    title: Optional[str] = "chore(siteAgent): automated changes"
    branch: Optional[str] = "siteagent/auto/update"
    body: Optional[str] = "Automated update by SiteAgent."


@router.post("/pr/open")
async def pr_open(payload: PROpenReq, body: bytes = Depends(_authorized)):
    """
    Open a PR with prepared artifacts. Requires auth.
    Returns 503 if GITHUB_TOKEN not configured (stub mode).
    """
    gh = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPO", "leok974/leo-portfolio")
    
    if not gh:
        raise HTTPException(
            status_code=503, 
            detail="pr_disabled: missing GITHUB_TOKEN. Set GITHUB_TOKEN env var to enable PR automation."
        )

    # Lightweight stub for now - returns config without making actual API call
    # TODO: Implement direct PR via GitHub REST API if desired
    return {
        "ok": True,
        "mode": "stub",
        "repo": repo,
        "title": payload.title,
        "branch": payload.branch,
        "url": None,
        "message": "PR opening delegated (stub). Wire GitHub REST here or trigger CI."
    }


# -----------------------------
# Nightly Workflow Generator
# -----------------------------
_WORKFLOW_TEMPLATE = """name: siteagent-nightly
on:
  schedule:
    - cron: '27 3 * * *'   # 03:27 UTC nightly
  workflow_dispatch: {}
jobs:
  nightly:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - name: Install deps
        run: pip install -r requirements.txt
      - name: Run safe SiteAgent tasks
        env:
          SITEAGENT_NIGHTLY: "1"
        run: |
          # Add safe automated tasks here
          echo "Nightly automation placeholder"
          # Example: python -m assistant_api.agent.runner --plan links.validate media.scan
      - name: Commit updates
        run: |
          git config user.name "siteagent-bot"
          git config user.email "bot@users.noreply.github.com"
          git add -A
          git commit -m "chore(siteAgent): nightly maintenance" || echo "no changes"
          git push || true
"""


@router.get("/automation/workflow")
async def automation_workflow():
    """
    Generate a GitHub Actions workflow YAML for nightly automation.
    Safe tasks only (no destructive operations).
    """
    return PlainTextResponse(_WORKFLOW_TEMPLATE, media_type="text/yaml")
