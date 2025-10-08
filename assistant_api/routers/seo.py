# assistant_api/routers/seo.py
from __future__ import annotations
from fastapi import APIRouter, Query
from fastapi.responses import PlainTextResponse
from pathlib import Path
from assistant_api.services.seo_tune import run_seo_tune, ARTIFACTS_DIR

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
