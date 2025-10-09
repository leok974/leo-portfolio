"""SEO Meta Suggestion Router

Generates SEO-optimized title and description suggestions using discovered keywords.
Phase 50.7 seed implementation.
"""
from __future__ import annotations
from pathlib import Path
from typing import Optional, List, Dict
import json
import re
import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from assistant_api.settings import get_settings
from assistant_api.utils.sitemap import discover_pages

router = APIRouter(prefix="/agent/seo/meta", tags=["agent", "seo"])

ART_DIR = Path("agent") / "artifacts" / "seo-meta"
ART_DIR.mkdir(parents=True, exist_ok=True)


def _sha256(b: bytes) -> str:
    """Compute SHA-256 hash of bytes."""
    h = hashlib.sha256()
    h.update(b)
    return h.hexdigest()


def _slugify(s: str) -> str:
    """Convert path to filesystem-safe slug."""
    s = re.sub(r"[^a-zA-Z0-9\-]+", "-", s.strip().lower()).strip("-")
    return s or "page"


def _limit(s: str, n: int) -> str:
    """Limit string to n characters, adding ellipsis if truncated."""
    s = re.sub(r"\s+", " ", s or "").strip()
    if len(s) <= n:
        return s
    return (s[:n-1]).rstrip() + "…"


def _load_keywords_index() -> Dict[str, List[str]]:
    """
    Returns { '/path': ['kw1','kw2','kw3', ...] }
    Uses seo-keywords.json if present; falls back to blank list.
    """
    idx: Dict[str, List[str]] = {}
    p = Path("agent") / "artifacts" / "seo-keywords.json"
    if p.exists():
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            for item in data.get("items", []):
                path = item.get("page", "")
                keywords = [k.get("term", "") for k in item.get("keywords", []) if k.get("term")]
                idx[path] = keywords
        except Exception:
            pass
    return idx


def _craft_title(base_title: str, kws: List[str]) -> str:
    """
    Craft SEO title preferring 1-2 top keywords, ≤ 60 chars.
    """
    parts = [base_title] if base_title else []
    if kws:
        parts.append(kws[0])
    if len(kws) > 1 and len(" — ".join(parts + [kws[1]])) <= 60:
        parts.append(kws[1])
    title = " — ".join(parts) if parts else "SiteAgent"
    return _limit(title, 60)


def _craft_desc(base_desc: str, kws: List[str]) -> str:
    """
    Build readable sentence weaving in 2-3 keywords, ≤ 155 chars.
    """
    if not base_desc and kws:
        base_desc = f"{kws[0].capitalize()} for your portfolio."
    phrase = base_desc or "Automatically optimized page metadata for better CTR."
    extras = []
    for k in kws[:3]:
        if k.lower() not in phrase.lower():
            extras.append(k)
    if extras:
        phrase += " Keywords: " + ", ".join(extras) + "."
    return _limit(phrase, 155)


@router.get("/suggest", summary="Suggest SEO title/description for a page")
def suggest_meta(
    path: str = Query(..., description="Site-relative path like /index.html"),
    settings: dict = Depends(get_settings)
):
    """
    Generate SEO-optimized title and description suggestions.

    Uses discovered page metadata and keywords from seo-keywords.json to craft:
    - Title: ≤60 characters, incorporating 1-2 top keywords
    - Description: ≤155 characters, weaving in 2-3 keywords

    Response:
    - generated_at: ISO timestamp
    - path: Requested path
    - base: Original {title, desc} from page
    - keywords: Top 6 keywords for the page
    - suggestion: {title, desc, limits}
    - integrity: SHA-256 checksum

    Artifacts written to: agent/artifacts/seo-meta/<slug>.json
    """
    # Optional dev guard (commented out for now to allow public access)
    # if str(settings.get("ALLOW_DEV_ROUTES", "0")) not in ("1","true","TRUE"):
    #     raise HTTPException(status_code=403, detail="Dev routes are disabled")

    pages = {p.path: p for p in discover_pages()}
    if path not in pages:
        raise HTTPException(status_code=404, detail=f"Unknown page: {path}")

    page = pages[path]
    keywords_idx = _load_keywords_index()
    kws = keywords_idx.get(path, [])

    title_suggestion = _craft_title(page.title or "", kws)
    desc_suggestion = _craft_desc(page.desc or "", kws)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "path": path,
        "base": {"title": page.title, "desc": page.desc},
        "keywords": kws[:6],
        "suggestion": {
            "title": title_suggestion,
            "desc": desc_suggestion,
            "limits": {"title_max": 60, "desc_max": 155}
        }
    }

    # Write artifact with integrity checksum
    out = ART_DIR / f"{_slugify(path)}.json"
    enc = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    integ = {"algo": "sha256", "value": _sha256(enc), "size": len(enc)}
    payload["integrity"] = integ
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    return JSONResponse(payload)
