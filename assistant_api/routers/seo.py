# assistant_api/routers/seo.py
from __future__ import annotations
from fastapi import APIRouter, Query
from fastapi.responses import PlainTextResponse
from pathlib import Path
from assistant_api.services.seo_tune import run_seo_tune, ARTIFACTS_DIR

router = APIRouter(prefix="/agent", tags=["agent-seo"])

@router.post("/run")
def run(task: str = Query(..., description="Task name, e.g., seo.tune"), dry_run: bool = False):
    if task != "seo.tune":
        return {"ok": False, "detail": "unsupported_task"}
    return run_seo_tune(dry_run=dry_run)

@router.get("/artifacts/seo-tune.diff", response_class=PlainTextResponse)
def get_seo_diff():
    p = ARTIFACTS_DIR / "seo-tune.diff"
    return p.read_text(encoding="utf-8") if p.exists() else ""

@router.get("/artifacts/seo-tune.md", response_class=PlainTextResponse)
def get_seo_log():
    p = ARTIFACTS_DIR / "seo-tune.md"
    return p.read_text(encoding="utf-8") if p.exists() else ""
