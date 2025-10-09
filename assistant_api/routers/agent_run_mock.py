"""Test-only mock route for fast E2E tests."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
import json
import hashlib

from ..settings import get_settings
from ..utils.cf_access import require_cf_access
from ..utils.artifacts import ensure_artifacts_dir, write_artifact

router = APIRouter(prefix="/agent/run", tags=["agent-mock"])


def _sha256_bytes(data: bytes) -> str:
    """Compute SHA-256 hex digest of bytes."""
    h = hashlib.sha256()
    h.update(data)
    return h.hexdigest()


@router.post("/mock")
def run_mock_plan(
    body: dict | None = None,
    principal: str = Depends(require_cf_access),
):
    """
    Instantly writes a fake seo-tune.{json,md} artifact for E2E smoke tests.
    Guarded by ALLOW_TEST_ROUTES.
    """
    settings = get_settings()

    if not settings.get("ALLOW_TEST_ROUTES"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Test routes disabled"
        )

    ensure_artifacts_dir(settings["ARTIFACTS_DIR"])
    now = datetime.now(timezone.utc).isoformat()

    # Build base payload without integrity field
    base_fake = {
        "generated": now,
        "threshold": float(body.get("threshold", 0.02) if body else 0.02),
        "count": 2,
        "pages": [
            {
                "url": "/",
                "ctr": 0.0089,
                "old_title": "Home",
                "old_description": "Welcome",
                "new_title": "Boost Results with Home — AI Automation",
                "new_description": "Fast load, clear value, and real outcomes. Learn how this project improves workflow and reliability.",
                "notes": "mock"
            },
            {
                "url": "/projects/siteagent",
                "ctr": 0.0112,
                "old_title": "SiteAgent",
                "old_description": "Self-updating portfolio site",
                "new_title": "SiteAgent — AI Automation for Self-Updating Portfolios",
                "new_description": "See how SiteAgent automates SEO tags and cards to keep your portfolio fresh.",
                "notes": "mock"
            }
        ]
    }

    # Compute integrity hash on stable JSON (no spaces for size consistency)
    encoded = json.dumps(base_fake, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    digest = _sha256_bytes(encoded)

    # Add integrity field to final payload
    fake = {
        **base_fake,
        "integrity": {
            "algo": "sha256",
            "value": digest,
            "size": len(encoded)
        }
    }

    md = [
        "# SEO Tune Report (mock)",
        f"- Generated: {now}",
        f"- Threshold: {fake['threshold']}",
        f"- Pages: {fake['count']}",
        "",
    ]
    for p in fake["pages"]:
        md += [
            f"## {p['url']}  (ctr={p['ctr']:.4f})",
            f"**Old title:** {p['old_title'] or '—'}",
            f"**New title:** {p['new_title']}",
            f"**Old description:** {p['old_description'] or '—'}",
            f"**New description:** {p['new_description']}",
            ""
        ]

    json_path = write_artifact(
        settings["ARTIFACTS_DIR"],
        "seo-tune.json",
        json.dumps(fake, ensure_ascii=False, indent=2)
    )
    md_path = write_artifact(
        settings["ARTIFACTS_DIR"],
        "seo-tune.md",
        "\n".join(md)
    )

    return {
        "ok": True,
        "mock": True,
        "json": json_path,
        "md": md_path,
        "count": fake["count"],
        "integrity": fake["integrity"]
    }
