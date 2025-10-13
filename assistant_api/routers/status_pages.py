"""Status Pages Router

Provides cached or on-demand page discovery status with integrity checksums.
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timezone
from pathlib import Path
from time import time

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, PlainTextResponse

from assistant_api.settings import get_settings
from assistant_api.utils.sitemap import (
    discover_pages,
    get_public_dirs,
    load_from_sitemap_files,
    resolve_file_for_url_path,
)

router = APIRouter(prefix="/agent/status", tags=["agent", "status"])

ART_DIR = Path("agent") / "artifacts"
ART_DIR.mkdir(parents=True, exist_ok=True)
STATUS = ART_DIR / "status.json"

# Rate limiting bucket (in-process)
_BUCKET = {}


def _allow(ip: str, key: str, limit=10, window=60):
    """Simple in-process rate limiter."""
    now = time()
    b = _BUCKET.get((ip, key), [])
    b = [t for t in b if now - t < window]
    if len(b) >= limit:
        return False
    b.append(now)
    _BUCKET[(ip, key)] = b
    return True


def _sha256_bytes(b: bytes) -> str:
    """Compute SHA-256 hash of bytes."""
    h = hashlib.sha256()
    h.update(b)
    return h.hexdigest()


@router.get("/pages", summary="Discovered pages (title/desc) from sitemap/public")
def pages_status():
    """
    Returns cached discovery if present; falls back to on-demand discovery.
    Adds an integrity checksum of the compact JSON for stability checks.

    Response includes:
    - ok: Always true
    - generated_at: ISO timestamp of generation
    - count: Number of discovered pages
    - pages: List of {path, title, desc}
    - integrity: {algo, value, size} for validation
    """
    payload = None

    # Try to load from cache
    if STATUS.exists():
        try:
            payload = json.loads(STATUS.read_text(encoding="utf-8"))
        except Exception:
            payload = None

    # Fallback to on-demand discovery
    if not payload:
        items = discover_pages()
        payload = {
            "generated_at": datetime.now(UTC).isoformat(),
            "pages": [
                {"path": p.path, "title": p.title, "desc": p.desc} for p in items
            ],
        }
        STATUS.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    # Compute integrity checksum
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode(
        "utf-8"
    )

    integ = {"algo": "sha256", "value": _sha256_bytes(compact), "size": len(compact)}

    return {"ok": True, "count": len(payload["pages"]), "integrity": integ, **payload}


MAX_RAW_BYTES = 2 * 1024 * 1024  # 2MB safety cap


@router.get("/open", summary="DEV: open underlying HTML for a given URL path")
def open_file(
    path: str = Query(..., description="Site-relative path, e.g. /index.html"),
    raw: int = Query(0, description="1 to stream raw file (text/html)"),
    request: Request = None,
    settings: dict = Depends(get_settings),
):
    """
    Dev-only route to open underlying HTML files.
    Guards against directory traversal and requires ALLOW_DEV_ROUTES=1.

    - path: Site-relative path (e.g., /index.html)
    - raw: If 1, streams the raw HTML; otherwise returns metadata JSON

    Returns:
    - Metadata JSON: {ok, abs_path, size, mtime, hint_raw_url}
    - Raw HTML: PlainTextResponse with text/html MIME type
    """
    # Rate limiting
    if request and not _allow(request.client.host, "open", limit=20, window=60):
        raise HTTPException(status_code=429, detail="Too many requests")

    # Dev-only guard
    if str(settings.get("ALLOW_DEV_ROUTES", "0")) not in ("1", "true", "TRUE"):
        raise HTTPException(status_code=403, detail="Dev routes are disabled")

    if not path.startswith("/"):
        raise HTTPException(
            status_code=400, detail="Path must be site-relative (start with /)"
        )

    f = resolve_file_for_url_path(path)
    if not f:
        raise HTTPException(
            status_code=404, detail=f"Not found under {get_public_dirs()}"
        )

    # Raw mode: stream HTML (size-capped)
    if raw:
        size = f.stat().st_size
        if size > MAX_RAW_BYTES:
            raise HTTPException(
                status_code=413, detail=f"File too large for raw view ({size} bytes)"
            )
        # Use plaintext if not html extension to avoid odd MIME surprises
        mime = (
            "text/html; charset=utf-8"
            if f.suffix.lower() in (".html", ".htm")
            else "text/plain; charset=utf-8"
        )
        text = f.read_text(encoding="utf-8", errors="ignore")
        return PlainTextResponse(
            text, media_type=mime, headers={"X-Resolved-Path": str(f)}
        )

    # Metadata JSON
    st = f.stat()
    payload = {
        "ok": True,
        "abs_path": str(f),
        "size": st.st_size,
        "mtime": st.st_mtime,
        "hint_raw_url": f"/agent/status/open?path={path}&raw=1",
    }
    return JSONResponse(payload)


@router.get("/sitemap", summary="Sitemap URLs and integrity (if sitemap.xml present)")
def sitemap_status(
    raw: int = Query(
        0, description="1 to stream the first discovered sitemap.xml as text"
    )
):
    """
    Returns sitemap URLs with integrity checksums, or streams raw sitemap.xml.

    Response (raw=0, metadata mode):
    - ok: Always true
    - files: List of absolute paths to discovered sitemap files
    - count: Number of URLs in sitemap
    - urls: List of URL paths from sitemap
    - integrity: SHA-256 checksum for validation

    Response (raw=1, streaming mode):
    - Streams first available sitemap.xml as application/xml
    - Header: X-Resolved-Path with absolute file path
    """
    files = []
    # Discover known sitemap locations (public/, dist/, root)
    for guess in ("public/sitemap.xml", "dist/sitemap.xml", "sitemap.xml"):
        p = Path(guess)
        if p.exists():
            files.append(str(p.resolve()))

    if raw:
        # Stream the first available sitemap, or 404 if none
        if not files:
            raise HTTPException(status_code=404, detail="No sitemap.xml found")
        text = Path(files[0]).read_text(encoding="utf-8", errors="ignore")
        return PlainTextResponse(
            text,
            media_type="application/xml; charset=utf-8",
            headers={"X-Resolved-Path": files[0]},
        )

    # Metadata mode: return URLs and integrity
    urls = load_from_sitemap_files()
    compact = json.dumps(
        {"files": files, "urls": urls}, ensure_ascii=False, separators=(",", ":")
    ).encode("utf-8")

    integ = {"algo": "sha256", "value": _sha256_bytes(compact), "size": len(compact)}

    return {
        "ok": True,
        "files": files,
        "count": len(urls),
        "urls": urls,
        "integrity": integ,
    }
