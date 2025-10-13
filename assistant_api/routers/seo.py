# assistant_api/routers/seo.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse

from assistant_api.services.seo_pr import SeoPRConfigError, open_seo_pr
from assistant_api.services.seo_tune import ARTIFACTS_DIR, run_seo_tune

router = APIRouter(prefix="/agent/seo", tags=["agent-seo"])


@router.post("/tune")
def run_seo_tune_endpoint(dry_run: bool = False):
    """Run SEO optimization task to generate meta tags, OG images, and sitemaps."""
    return run_seo_tune(dry_run=dry_run)


@router.get("/artifacts/diff", response_class=PlainTextResponse)
def get_seo_diff():
    """Retrieve the SEO tune diff artifact."""
    p = ARTIFACTS_DIR / "seo-tune.diff"
    return p.read_text(encoding="utf-8") if p.exists() else ""


@router.get("/artifacts/log", response_class=PlainTextResponse)
def get_seo_log():
    """Retrieve the SEO tune reasoning log artifact."""
    p = ARTIFACTS_DIR / "seo-tune.md"
    return p.read_text(encoding="utf-8") if p.exists() else ""


@router.post("/act")
def act(action: str = Query(..., description="Action to perform (e.g., 'seo.pr')")):
    """Execute an SEO-related action (e.g., create PR with changes)."""
    if action == "seo.pr":
        try:
            return open_seo_pr()
        except SeoPRConfigError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except FileNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PR creation failed: {str(e)}")

    return {"ok": False, "detail": "unsupported_action"}
