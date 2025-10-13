"""
Upload Router - Handles file uploads with optional gallery card creation.

Supports:
- Image and video uploads
- Automatic FFmpeg poster generation for videos
- Gallery card creation with metadata
- Sitemap refresh after upload
"""

import os
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from assistant_api.services.gallery_service import (
    add_gallery_item,
    ffmpeg_poster,
    run_media_lint,
    run_sitemap_refresh,
    save_upload,
)
from assistant_api.utils.cf_access import require_cf_access

router = APIRouter(
    prefix="/api/uploads", tags=["uploads"], dependencies=[Depends(require_cf_access)]
)


@router.post("")
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
    ext = (file.filename or "").lower()

    # Save file (type already detected above)
    kind = "video" if is_video else "image"

    # Save to public/assets/{uploads,video}/YYYY/MM/
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
            tools=[t.strip() for t in (tools or "").split(",") if t.strip()] or None,
            tags=[t.strip() for t in (tags or "").split(",") if t.strip()] or None,
        )
    else:
        # Try to generate poster with ffmpeg
        poster_rel = None
        poster_abs = saved["path"].rsplit(".", 1)[0] + ".jpg"

        if ffmpeg_poster(saved["path"], poster_abs):
            # Convert to site-relative URL
            poster_rel = "/" + poster_abs.split("public/")[-1].replace("\\", "/")

        item = add_gallery_item(
            title=title or file.filename or "Untitled",
            description=description or "",
            typ="video-local",
            src=saved["url"],
            poster=poster_rel,
            tools=[t.strip() for t in (tools or "").split(",") if t.strip()] or None,
            tags=[t.strip() for t in (tags or "").split(",") if t.strip()] or None,
        )

    # Refresh sitemap and validate
    run_sitemap_refresh()
    lint_ok = run_media_lint(strict=False)

    return JSONResponse({"ok": True, "item": item, "lint_ok": lint_ok})
