"""
SEO Meta Apply Router - Preview & Commit (dev-only)

Provides endpoints to preview and commit SEO meta changes with:
- Traversal guards (public dirs only)
- PR-ready unified diffs
- Timestamped backups
- SHA-256 integrity on artifacts
"""

from __future__ import annotations

import difflib
import hashlib
import html
import json
import re
from datetime import UTC, datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from assistant_api.settings import get_settings
from assistant_api.utils.sitemap import resolve_file_for_url_path

router = APIRouter(prefix="/agent/seo/meta", tags=["agent", "seo"])

ART_DIR = Path("agent") / "artifacts" / "seo-meta-apply"
ART_DIR.mkdir(parents=True, exist_ok=True)

# Regex patterns for HTML manipulation
TITLE_RE = re.compile(
    r"(<\s*title[^>]*>)(.*?)(</\s*title\s*>)", re.IGNORECASE | re.DOTALL
)
HEAD_RE = re.compile(r"<\s*head[^>]*>", re.IGNORECASE)
DESC_RE = re.compile(
    r'(<\s*meta[^>]+name\s*=\s*["\']description["\'][^>]*content\s*=\s*["\'])(.*?)((["\'][^>]*>))',
    re.IGNORECASE | re.DOTALL,
)


def _sha256_bytes(b: bytes) -> str:
    """Compute SHA-256 hash of bytes."""
    h = hashlib.sha256()
    h.update(b)
    return h.hexdigest()


def _slugify(s: str) -> str:
    """Convert path to filesystem-safe slug."""
    return re.sub(r"[^a-zA-Z0-9\-]+", "-", s.strip("/").lower() or "page")


def _limit(s: str, n: int) -> str:
    """Limit string to n characters with ellipsis."""
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else (s[: n - 1]).rstrip() + "…"


def _ensure_head_wrapped(html: str) -> str:
    """Ensure HTML has a <head> tag."""
    if re.search(r"<\s*head[^>]*>", html, re.IGNORECASE):
        return html
    # Place after <html ...>
    m = re.search(r"<\s*html[^>]*>", html, re.IGNORECASE)
    if m:
        i = m.end()
        return html[:i] + "\n<head>\n</head>" + html[i:]
    # Prepend as fallback
    return "<head>\n</head>\n" + html


def _set_title(html: str, new_title: str | None) -> tuple[str, bool]:
    """Set or update <title> tag in HTML."""
    if not new_title:
        return html, False
    new_title = _limit(new_title, 60)
    if TITLE_RE.search(html):
        return TITLE_RE.sub(rf"\1{new_title}\3", html, count=1), True
    # Insert <title> as first child of <head>
    html2 = _ensure_head_wrapped(html)
    return (
        re.sub(
            r"(<\s*head[^>]*>)",
            rf"\1\n  <title>{new_title}</title>",
            html2,
            count=1,
            flags=re.IGNORECASE,
        ),
        True,
    )


def _set_meta_desc(html_src: str, new_desc: str | None) -> tuple[str, bool]:
    """Set or update meta description in HTML."""
    if new_desc is None:
        return html_src, False
    new_desc = _limit(new_desc, 155)
    # Escape for HTML attribute context
    safe = html.escape(new_desc, quote=True)
    if DESC_RE.search(html_src):
        # use callable to avoid backref escapes
        return (
            DESC_RE.sub(lambda m: f"{m.group(1)}{safe}{m.group(3)}", html_src, count=1),
            True,
        )
    # Add meta description near the top of <head>
    html2 = _ensure_head_wrapped(html_src)
    return (
        re.sub(
            r"(<\s*head[^>]*>)",
            lambda m: f'{m.group(1)}\n  <meta name="description" content="{safe}">',
            html2,
            count=1,
            flags=re.IGNORECASE,
        ),
        True,
    )


def _apply_changes(
    orig_html: str, title: str | None, desc: str | None
) -> tuple[str, dict[str, bool]]:
    """Apply title and description changes to HTML."""
    changed = {"title": False, "description": False}
    html = orig_html
    html2, ct = _set_title(html, title)
    changed["title"] = ct
    html3, cd = _set_meta_desc(html2, desc)
    changed["description"] = cd
    return html3, changed


def _unified_diff(path: str, before: str, after: str) -> str:
    """Generate unified diff between before and after HTML."""
    before_lines = before.splitlines(keepends=True)
    after_lines = after.splitlines(keepends=True)
    diff = difflib.unified_diff(
        before_lines,
        after_lines,
        fromfile=f"a:{path}",
        tofile=f"b:{path}",
        lineterm="",
    )
    return "".join(diff)


def _write_artifacts(slug: str, info: dict[str, Any]) -> dict[str, Any]:
    """Write diff, preview HTML, and metadata artifacts to disk."""
    base = ART_DIR / slug
    base.parent.mkdir(parents=True, exist_ok=True)
    (base.with_suffix(".diff")).write_text(info["diff"], encoding="utf-8")
    (base.with_suffix(".preview.html")).write_text(
        info["preview_html"], encoding="utf-8"
    )

    meta = {
        "ts": info["ts"],
        "path": info["path"],
        "changed": info["changed"],
        "proposal": {
            "title": info.get("proposal_title"),
            "desc": info.get("proposal_desc"),
        },
        "files": {
            "diff": str(base.with_suffix(".diff")),
            "preview_html": str(base.with_suffix(".preview.html")),
        },
    }
    enc = json.dumps(meta, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    integ = {"algo": "sha256", "value": _sha256_bytes(enc), "size": len(enc)}
    meta["integrity"] = integ
    (base.with_suffix(".apply.json")).write_text(
        json.dumps(meta, indent=2), encoding="utf-8"
    )
    return meta


@router.post("/preview", summary="Dev: preview meta changes with PR-ready diff")
def preview_meta(
    path: str = Query(..., description="Site-relative path, e.g. /index.html"),
    payload: dict[str, str | None] = Body(
        ..., example={"title": "New title", "desc": "New description"}
    ),
):
    """
    Preview SEO meta changes without modifying files.
    Returns diff and artifacts for review.
    """
    f = resolve_file_for_url_path(path)
    if not f:
        raise HTTPException(
            status_code=404, detail=f"Cannot resolve {path} under public dirs"
        )

    orig_html = f.read_text(encoding="utf-8", errors="ignore")
    new_html, changed = _apply_changes(
        orig_html, payload.get("title"), payload.get("desc")
    )
    diff = _unified_diff(path, orig_html, new_html)

    ts = datetime.now(UTC).isoformat()
    slug = _slugify(path)
    meta = _write_artifacts(
        slug,
        {
            "ts": ts,
            "path": path,
            "changed": changed,
            "diff": diff,
            "preview_html": new_html,
            "proposal_title": payload.get("title"),
            "proposal_desc": payload.get("desc"),
        },
    )

    return JSONResponse(
        {
            "ok": True,
            "path": path,
            "changed": changed,
            "artifacts": meta["files"],
            "integrity": meta["integrity"],
            "ts": ts,
            "empty_diff": (diff.strip() == ""),
        }
    )


@router.post("/commit", summary="Dev: apply meta changes to file (with backup)")
def commit_meta(
    path: str = Query(...),
    payload: dict[str, str | None] = Body(...),
    confirm: int = Query(0, description="Set to 1 to actually write changes"),
    expect_mtime: float = Query(
        None, description="Optional: expected source file mtime"
    ),
    expect_sha256: str = Query(
        None, description="Optional: expected source file sha256"
    ),
    settings: dict = Depends(get_settings),
):
    """
    Apply SEO meta changes to HTML file with backup.
    Requires ALLOW_DEV_ROUTES=1 and confirm=1 to write.
    """
    if str(settings.get("ALLOW_DEV_ROUTES", "0")) not in ("1", "true", "TRUE"):
        raise HTTPException(status_code=403, detail="Dev routes are disabled")

    f = resolve_file_for_url_path(path)
    if not f:
        raise HTTPException(
            status_code=404, detail=f"Cannot resolve {path} under public dirs"
        )

    orig_html = f.read_text(encoding="utf-8", errors="ignore")
    st = f.stat()
    if expect_mtime is not None and abs(st.st_mtime - float(expect_mtime)) > 1e-6:
        raise HTTPException(
            status_code=409, detail="Source modified since preview (mtime mismatch)"
        )
    if expect_sha256:
        orig_digest = _sha256_bytes(orig_html.encode("utf-8"))
        if orig_digest != expect_sha256:
            raise HTTPException(
                status_code=409, detail="Source modified since preview (hash mismatch)"
            )

    new_html, changed = _apply_changes(
        orig_html, payload.get("title"), payload.get("desc")
    )
    diff = _unified_diff(path, orig_html, new_html)
    ts = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")

    slug = _slugify(path)
    meta = _write_artifacts(
        slug,
        {
            "ts": ts,
            "path": path,
            "changed": changed,
            "diff": diff,
            "preview_html": new_html,
            "proposal_title": payload.get("title"),
            "proposal_desc": payload.get("desc"),
        },
    )

    if not confirm:
        return JSONResponse(
            {
                "ok": True,
                "dry_run": True,
                "path": path,
                "changed": changed,
                "artifacts": meta["files"],
                "integrity": meta["integrity"],
                "note": "Pass confirm=1 to write changes",
            }
        )

    # Backup then write
    backup = f.with_suffix(f".bak.{ts}{f.suffix}")
    backup.write_text(orig_html, encoding="utf-8")
    f.write_text(new_html, encoding="utf-8")

    # Audit log
    log = ART_DIR.parent / "apply.log.jsonl"
    entry = {"ts": ts, "path": path, "backup": str(backup), "changed": changed}
    with log.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")

    return JSONResponse(
        {
            "ok": True,
            "applied": True,
            "path": path,
            "backup": str(backup),
            "changed": changed,
            "artifacts": meta["files"],
            "integrity": meta["integrity"],
        }
    )
