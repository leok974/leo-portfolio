"""
Admin Router - Administrative endpoints protected by Cloudflare Access.

ALL privileged operations live under /api/admin/* with a single CF Access guard.

Endpoints:
- GET  /api/admin/whoami         - Returns authenticated user's email (smoke test)
- POST /api/admin/uploads        - Upload images/videos with optional gallery card
- POST /api/admin/gallery/add    - Add gallery item with metadata
"""

import os
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from assistant_api.services.gallery_service import (
    add_gallery_item,
    ffmpeg_poster,
    run_media_lint,
    run_sitemap_refresh,
    save_upload,
)
from assistant_api.utils.cf_access import require_cf_access

# Single router with CF Access guard applied to ALL endpoints
router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_cf_access)],  # <- Guard applied globally
)


# ============================================================================
# Smoke Test / Identity
# ============================================================================


@router.get("/whoami")
def whoami(request: Request, principal: str = Depends(require_cf_access)):
    """
    Returns the authenticated principal from the verified JWT.

    Useful for:
    - Smoke testing CF Access integration
    - Verifying JWT verification is working
    - Checking which user/service is authenticated

    Returns:
        dict: {"ok": True, "principal": "user@example.com"} for users
              {"ok": True, "principal": "service-token-name"} for service tokens
    """
    return {"ok": True, "principal": principal}


# ============================================================================
# File Uploads
# ============================================================================


@router.post("/uploads")
async def upload_file(
    file: UploadFile = File(...),
    make_card: bool = Form(False),
    title: str | None = Form(None),
    description: str | None = Form(None),
    tools: str | None = Form(None),  # comma-separated
    tags: str | None = Form(None),  # comma-separated
):
    """
    Upload image or video file.

    Args:
        file: UploadFile to save
        make_card: Whether to create a gallery card
        title: Gallery card title (defaults to filename)
        description: Gallery card description
        tools: Comma-separated tool names
        tags: Comma-separated tags

    Returns:
        JSON response with upload details and optional gallery item
    """
    # Configuration
    MAX_IMG_MB = int(os.getenv("MAX_IMAGE_MB", "30"))
    MAX_VID_MB = int(os.getenv("MAX_VIDEO_MB", "200"))

    # Read file content
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)

    # Detect file type
    ext = (file.filename or "").lower()
    is_video = ext.endswith((".mp4", ".mov", ".webm", ".mkv", ".m4v"))

    # Size validation
    if (is_video and size_mb > MAX_VID_MB) or (not is_video and size_mb > MAX_IMG_MB):
        raise HTTPException(
            status_code=413,
            detail=f"File too large: {size_mb:.1f}MB (max: {MAX_VID_MB if is_video else MAX_IMG_MB}MB)",
        )

    # MIME type validation for images
    if not is_video and not ext.endswith(
        (".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg")
    ):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type: {ext}. Allowed: png, jpg, jpeg, gif, webp, avif, svg, mp4, mov, webm, mkv, m4v",
        )

    # Save file
    kind = "video" if is_video else "image"
    saved = save_upload(content, file.filename or "upload.bin", kind)

    if not make_card:
        return JSONResponse({"ok": True, "url": saved["url"], "kind": kind})

    # Build gallery item
    if kind == "image":
        item = add_gallery_item(
            title=title or file.filename or "Untitled",
            description=description or "",
            typ="image",
            src=saved["url"],
            tools=(tools or "").split(",") if tools else None,
            tags=(tags or "").split(",") if tags else None,
        )
    else:
        # Generate poster for video
        poster_url = ffmpeg_poster(saved["path"])
        item = add_gallery_item(
            title=title or file.filename or "Untitled",
            description=description or "",
            typ="video-local",
            src=saved["url"],
            poster=poster_url,
            mime="video/mp4",
            tools=(tools or "").split(",") if tools else None,
            tags=(tags or "").split(",") if tags else None,
        )

    # Refresh sitemap and validate
    run_sitemap_refresh()
    lint_ok = run_media_lint(strict=False)

    return JSONResponse(
        {
            "ok": True,
            "url": saved["url"],
            "kind": kind,
            "item": item,
            "lint_ok": lint_ok,
        }
    )


# ============================================================================
# Gallery Management
# ============================================================================


class AddItemRequest(BaseModel):
    """Request body for adding gallery item."""

    title: str
    description: str = ""
    type: str = Field(pattern=r"^(image|video-local|youtube|vimeo)$")
    src: str
    poster: str | None = None
    mime: str | None = None
    tools: list[str] | None = None
    workflow: list[str] | None = None
    tags: list[str] | None = None


@router.post("/gallery/add")
async def gallery_add(body: AddItemRequest):
    """
    Add new gallery item (agent-callable).

    Body:
        title: Display title
        description: Brief description
        type: 'image' | 'video-local' | 'youtube' | 'vimeo'
        src: Asset URL (site-relative or external)
        poster: Thumbnail URL (required for videos in sitemap)
        mime: MIME type (for local videos)
        tools: Array of tool names
        workflow: Array of workflow step strings
        tags: Array of tag strings

    Returns:
        { ok, item, lint_ok }
    """
    item = add_gallery_item(
        title=body.title,
        description=body.description,
        typ=body.type,  # type: ignore - validated by pattern
        src=body.src,
        poster=body.poster,
        mime=body.mime,
        tools=body.tools,
        workflow=body.workflow,
        tags=body.tags,
    )

    # Refresh sitemap and validate
    run_sitemap_refresh()
    lint_ok = run_media_lint(strict=False)

    return {"ok": True, "item": item, "lint_ok": lint_ok}
