"""Mock SEO Keywords Router for Fast E2E Tests

Generates deterministic keyword artifacts instantly without LLM dependencies.
Useful for CI smoke tests and local development verification.
"""
from __future__ import annotations
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException

from ..settings import get_settings
from ..utils.artifacts import ensure_artifacts_dir

router = APIRouter(prefix="/agent/seo", tags=["agent", "seo-mock"])

# Reuse agent artifacts directory
ART_DIR = None  # Will be set on first use from settings


def _get_artifact_dir(settings: dict) -> Path:
    """Get artifact directory from settings, create if needed."""
    global ART_DIR
    if ART_DIR is None:
        ART_DIR = Path(settings.get("ARTIFACTS_DIR", "./agent_artifacts"))
        ART_DIR.mkdir(parents=True, exist_ok=True)
    return ART_DIR


def _sha256_bytes(data: bytes) -> str:
    """Compute SHA-256 hex digest of bytes."""
    h = hashlib.sha256()
    h.update(data)
    return h.hexdigest()


def _write_mock_keywords(settings: dict) -> dict:
    """Write deterministic mock keyword artifacts with integrity."""
    art_dir = _get_artifact_dir(settings)
    art_json = art_dir / "seo-keywords.json"
    art_md = art_dir / "seo-keywords.md"

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "mock",
        "inputs": {
            "analytics": "underperformers (mock)",
            "source": "sitemap|defaults (mock)"
        },
        "items": [
            {
                "page": "/index.html",
                "title": "SiteAgent — Leo Klemet",
                "desc": "Autonomous portfolio agent that maintains itself",
                "keywords": [
                    {"term": "AI portfolio automation", "score": 0.96, "trend": 82},
                    {"term": "autonomous website builder", "score": 0.92, "trend": 74},
                    {"term": "self-updating site", "score": 0.90, "trend": 69},
                    {"term": "agentic SEO", "score": 0.88, "trend": 61},
                    {"term": "portfolio", "score": 0.82, "trend": 77},
                ],
            },
            {
                "page": "/agent.html",
                "title": "Vision Manifesto",
                "desc": "Self-maintaining portfolio builder, agentic automation, SEO intelligence",
                "keywords": [
                    {"term": "agentic automation", "score": 0.93, "trend": 71},
                    {"term": "SEO intelligence", "score": 0.90, "trend": 64},
                    {"term": "resume generator", "score": 0.79, "trend": 58},
                    {"term": "website builder", "score": 0.84, "trend": 70},
                    {"term": "SiteAgent", "score": 0.91, "trend": 66},
                ],
            },
        ],
    }

    # Compute integrity on base payload (before adding integrity field)
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    digest = _sha256_bytes(encoded)
    payload["integrity"] = {
        "algo": "sha256",
        "value": digest,
        "size": str(len(encoded))
    }

    # Write pretty JSON
    art_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    # Write Markdown
    lines = [
        "# SEO Keywords Report (mock)",
        f"- **Generated:** {payload['generated_at']}",
        f"- **Mode:** {payload['mode']}",
        f"- **Integrity:** `sha256:{digest}` ({payload['integrity']['size']} bytes)",
        ""
    ]
    for page in payload["items"]:
        lines.append(f"## {page['page']}")
        if page.get("title"):
            lines.append(f"**Title:** {page['title']}")
        if page.get("desc"):
            lines.append(f"**Description:** {page['desc']}")
        lines.append("")
        for kw in page["keywords"]:
            eff = round(kw["score"] * (kw["trend"] / 100.0), 3)
            lines.append(
                f"- `{kw['term']}` — score **{kw['score']}**, trend **{kw['trend']}**, effectiveness **{eff}**"
            )
        lines.append("")

    art_md.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")
    return payload


@router.post("/keywords/mock", summary="Generate mock keyword artifacts (fast CI)")
def run_mock() -> dict:
    """
    Instantly writes deterministic mock seo-keywords.{json,md} artifacts.

    - No LLM dependencies
    - Deterministic output for CI verification
    - Includes SHA-256 integrity checksums
    - Guarded by ALLOW_TEST_ROUTES (implicitly via router registration)
    """
    settings = get_settings()

    if not settings.get("ALLOW_TEST_ROUTES"):
        raise HTTPException(
            status_code=403,
            detail="Test routes disabled. Set ALLOW_TEST_ROUTES=1 to enable."
        )

    payload = _write_mock_keywords(settings)
    art_dir = _get_artifact_dir(settings)

    return {
        "ok": True,
        "artifacts": [
            {
                "file": str(art_dir / "seo-keywords.json"),
                "type": "json",
                "integrity": payload["integrity"]
            },
            {
                "file": str(art_dir / "seo-keywords.md"),
                "type": "markdown"
            }
        ],
        "payload": payload
    }


@router.get("/keywords/mock", summary="Fetch existing mock keyword artifacts")
def get_mock() -> dict:
    """Retrieve the most recently generated mock keyword report."""
    settings = get_settings()
    art_dir = _get_artifact_dir(settings)
    art_json = art_dir / "seo-keywords.json"

    if not art_json.exists():
        raise HTTPException(
            status_code=404,
            detail="No seo-keywords.json found. Run POST /agent/seo/keywords/mock first."
        )

    return json.loads(art_json.read_text(encoding="utf-8"))
