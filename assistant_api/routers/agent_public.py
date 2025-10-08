"""Public siteAgent endpoint with dual authentication (CF Access OR HMAC)."""
from fastapi import APIRouter, Request, HTTPException, Depends, Query, Response, Cookie, Body
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from urllib.parse import urlparse
from enum import Enum
import hmac
import hashlib
import os
import json
import base64
import time
import httpx
import subprocess
from pathlib import Path
from ..agent.runner import run, DEFAULT_PLAN
from ..agent.tasks import REGISTRY
from ..agent.models import recent_runs, query_events
from ..utils.cf_access import require_cf_access
from ..agent.interpret import parse_command
from ..services.pr_utils import git_commit, open_pr_via_api
from ..services.layout_opt import run_layout_optimize
from ..services.scheduler import pick_preset_for_day
from ..services.weights_autotune import run_autotune
from ..services.agent_events import log_event, recent_events
import datetime as dt

router = APIRouter(prefix="/agent", tags=["agent-public"])

# -----------------------------
# Artifacts Configuration
# -----------------------------
ARTIFACTS_DIR = Path(os.getenv("SITEAGENT_ARTIFACTS_DIR", "assets/data"))
LINK_APPLY_FILES = ARTIFACTS_DIR / "link-apply.files.json"

def _ensure_artifacts_dir():
    """Ensure artifacts directory exists."""
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

# Logo fetch host allowlist
ALLOWED_LOGO_HOSTS = [h.strip() for h in os.getenv("SITEAGENT_LOGO_HOSTS", "").split(",") if h.strip()]

def _host_allowed(url: str) -> bool:
    """Check if logo fetch URL host is in allowlist."""
    if not ALLOWED_LOGO_HOSTS:  # dev-friendly default; set in prod
        return True
    host = urlparse(url).hostname or ""
    return any(host == h or host.endswith("." + h) for h in ALLOWED_LOGO_HOSTS)

# -----------------------------
# Models
# -----------------------------
class RunReq(BaseModel):
    plan: Optional[List[str]] = None
    params: Optional[Dict[str, Any]] = None


class ActReq(BaseModel):
    command: Optional[str] = None
    task: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


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
    task: Optional[str] = Query(None, description="Filter by task name"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of events to return")
):
    """Get recent agent events with optional filtering (public endpoint)."""
    # Note: query_events currently supports level and run_id
    # Task filtering would need to be added to the models layer
    event_list = query_events(level=level, run_id=run_id, limit=limit)

    # Filter by task in-memory if needed (until models layer supports it)
    if task:
        event_list = [e for e in event_list if e.get("task") == task]

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


@router.get("/artifacts/link-apply.files")
async def list_link_apply_files():
    """
    List files that would be touched by links.apply.
    Returns file manifest from last dry-run.
    """
    _ensure_artifacts_dir()
    if not LINK_APPLY_FILES.exists():
        return {"files": [], "note": "Run dry-run first."}

    try:
        with open(LINK_APPLY_FILES, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {"files": data.get("files", [])}
    except Exception as e:
        return {"files": [], "error": str(e)}


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
    Natural-language agent commands or direct task execution.
    Supports:
    - Natural language via 'command' field
    - Direct task execution via 'task' + 'payload' fields
    - Special tasks: layout.optimize, layout.apply, pr.create
    """
    payload = ActReq(**json.loads(body or b"{}"))

    # Handle direct task execution
    if payload.task:
        task_name = payload.task
        task_payload = payload.payload or {}

        # layout.optimize - run optimization with preset
        if task_name == "layout.optimize":
            return run_layout_optimize(task_payload)

        # layout.apply - commit the layout file
        if task_name == "layout.apply":
            layout_path = Path("assets/layout.json")
            if not layout_path.exists():
                raise HTTPException(400, detail="No proposed layout found")

            # Create feature branch
            branch = f"feat/layout-{int(time.time())}"
            subprocess.run(["git", "checkout", "-b", branch], check=False)

            # Commit the layout
            commit = git_commit(str(layout_path), "feat: apply layout sections/preset")

            return {
                "ok": True,
                "task": "layout.apply",
                "branch": branch,
                "commit": commit,
                "file": str(layout_path)
            }

        # pr.create - open GitHub PR
        if task_name == "pr.create":
            branch = task_payload.get("branch")
            title = task_payload.get("title", "chore: SiteAgent automated layout update")
            body_text = task_payload.get("body", "Auto-generated by SiteAgent.\n\nIncludes: layout sections/preset.")

            if not branch:
                raise HTTPException(400, detail="branch required in payload")

            result = open_pr_via_api(head_branch=branch, title=title, body=body_text)

            if not result.get("ok"):
                raise HTTPException(500, detail=f"PR creation failed: {result.get('error')}")

            return {
                "ok": True,
                "task": "pr.create",
                "pr_url": result.get("pr_url"),
                "pr_number": result.get("pr_number"),
                "details": result
            }

        # Unknown task
        raise HTTPException(400, detail=f"unknown task: {task_name}")

    # Handle natural language command
    if payload.command:
        # Parse natural language command
        plan, params = parse_command(payload.command)
        if not plan:
            raise HTTPException(status_code=400, detail="Could not interpret command")

        # Special handling for logo.fetch to validate host
        if "logo.fetch" in plan and params.get("url"):
            url = params["url"]
            if not _host_allowed(url):
                raise HTTPException(
                    status_code=400,
                    detail=f"disallowed_host: {urlparse(url).hostname} not in SITEAGENT_LOGO_HOSTS allowlist"
                )

        return run(plan, params)

    # Neither command nor task provided
    raise HTTPException(400, detail="Either 'command' or 'task' field required")


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
    Returns 503 if GITHUB_TOKEN not configured.
    Uses GitHub REST API when token is available.
    """
    gh = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPO", "leok974/leo-portfolio")
    base_url = os.environ.get("GITHUB_API_BASE", "https://api.github.com")

    if not gh:
        raise HTTPException(
            status_code=503,
            detail="pr_disabled: missing GITHUB_TOKEN. Set GITHUB_TOKEN env var to enable PR automation."
        )

    title = payload.title or "chore(siteAgent): automated changes"
    branch = payload.branch or "siteagent/auto/update"
    pr_body = payload.body or "Automated update by SiteAgent."

    # Call GitHub REST API to create PR
    async with httpx.AsyncClient(timeout=20) as client:
        # Get default branch
        r_repo = await client.get(
            f"{base_url}/repos/{repo}",
            headers={"Authorization": f"Bearer {gh}", "Accept": "application/vnd.github+json"}
        )
        if r_repo.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"github_repo_error: Failed to fetch repo info (status {r_repo.status_code})"
            )

        default_branch = r_repo.json().get("default_branch", "main")

        # Create pull request
        pr_payload = {
            "title": title,
            "head": branch,
            "base": default_branch,
            "body": pr_body,
            "draft": False
        }
        r_pr = await client.post(
            f"{base_url}/repos/{repo}/pulls",
            json=pr_payload,
            headers={"Authorization": f"Bearer {gh}", "Accept": "application/vnd.github+json"}
        )

        # 422 means PR already exists (acceptable)
        if r_pr.status_code not in (201, 422):
            raise HTTPException(
                status_code=502,
                detail=f"github_pr_error: Failed to create PR (status {r_pr.status_code})"
            )

        pr_data = r_pr.json()
        return {
            "ok": True,
            "repo": repo,
            "url": pr_data.get("html_url"),
            "number": pr_data.get("number"),
            "status": "created" if r_pr.status_code == 201 else "already_exists"
        }

# -----------------------------
# Nightly Workflow Generator
# -----------------------------
@router.get("/automation/workflow")
async def automation_workflow(
    include: Optional[str] = Query(None, description="Comma-separated list of tasks to include"),
    exclude: Optional[str] = Query(None, description="Comma-separated list of tasks to exclude"),
    dry_run: bool = Query(False, description="Enable dry-run mode for all tasks")
):
    """
    Generate a GitHub Actions workflow YAML for nightly automation.
    Safe tasks only (no destructive operations).
    Supports task filtering and dry-run mode.
    """
    # Available safe tasks
    task_all = ["links.validate", "media.optimize", "sitemap.media.update"]

    # Process include/exclude filters
    inc_set = set([t.strip() for t in (include or "").split(",") if t.strip()]) or set(task_all)
    exc_set = set([t.strip() for t in (exclude or "").split(",") if t.strip()])
    tasks = [t for t in task_all if t in inc_set and t not in exc_set]

    # Generate task run lines
    run_lines = []
    banner = "echo '⚠️  DRY-RUN ENABLED - No changes will be committed'" if dry_run else ""

    for t in tasks:
        if t == "media.optimize":
            cmd = f"python -m assistant_api.cli run {t} {'--safe --dry-run' if dry_run else '--safe'}"
        else:
            cmd = f"python -m assistant_api.cli run {t} {'--dry-run' if dry_run else ''}"
        run_lines.append(cmd.strip())

    # Build workflow YAML
    workflow = f"""name: siteagent-nightly
on:
  schedule:
    - cron: '27 3 * * *'   # 03:27 UTC nightly
  workflow_dispatch: {{}}
jobs:
  nightly:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: {{ python-version: '3.11' }}
      - name: Install deps
        run: pip install -r requirements.txt
      - name: Run SiteAgent tasks
        env:
          SITEAGENT_NIGHTLY: "1"
        run: |
          {banner}
          {chr(10).join('          ' + line for line in run_lines)}
      - name: Commit updates
        run: |
          git config user.name "siteagent-bot"
          git config user.email "bot@users.noreply.github.com"
          git add -A
          git commit -m "chore(siteAgent): nightly maintenance" || echo "no changes"
          git push || true
"""

    return PlainTextResponse(workflow, media_type="text/yaml")


@router.post("/run_now")
async def run_now(
    req: Request,
    body: bytes = Depends(_authorized),
    preset: Optional[str] = None
):
    """
    Manually trigger layout optimization with specified or auto-selected preset.

    Args:
        preset: Optimization preset (recruiter, hiring_manager, etc.)
                If not provided, selects based on current day type.

    Returns:
        Optimization result with summary
    """
    # Use preset from query or select based on today's day type
    selected_preset = preset or pick_preset_for_day(dt.date.today())

    # Run optimization
    result = run_layout_optimize({"preset": selected_preset})

    # Log event for audit trail
    log_event("manual.optimize", {
        "preset": selected_preset,
        "summary": result.get("summary"),
        "status": result.get("status")
    })

    return {
        "ok": True,
        "preset": selected_preset,
        "summary": result.get("summary"),
        "status": result.get("status")
    }


@router.post("/autotune")
async def autotune(
    req: Request,
    body: bytes = Depends(_authorized),
    alpha: float = 0.5
):
    """
    Run adaptive weight tuning based on A/B test results (Phase 50.3).

    Args:
        alpha: Learning rate (0-1). Higher = more aggressive tuning.
               Default 0.5 for gradual adjustment.

    Returns:
        Dict with tuned weights, A/B suggestion, and optimization result
    """
    return run_autotune(alpha=alpha)


@router.get("/events")
async def list_events(
    req: Request,
    _: bytes = Depends(_authorized),
    limit: int = Query(default=50, le=200)
):
    """
    Get recent agent events (scheduler runs, manual optimizations, autotuning).

    Args:
        limit: Maximum number of events to return (max 200)

    Returns:
        List of recent events with timestamps
    """
    return {"events": recent_events(limit=limit)}
