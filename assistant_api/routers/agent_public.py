"""Public siteAgent endpoint with dual authentication (CF Access OR HMAC)."""
from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import hmac
import hashlib
import os
import json
from pathlib import Path
from ..agent.runner import run, DEFAULT_PLAN
from ..agent.tasks import REGISTRY
from ..agent.models import recent_runs
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
    return {
        "brand": status_data.get("brand"),
        "status_ts": status_data.get("ts"),
        "projects": len(projects.get("projects", [])),
        "media_count": media.get("count", 0),
        "news_items": len(news.get("items", [])),
        "links_checked": links.get("checked", 0),
        "links_missing": len(links.get("missing", [])),
        "samples": {
            "missing": links.get("missing", [])[:5],
            "news": news.get("items", [])[:5],
        },
    }


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
