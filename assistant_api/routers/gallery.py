"""
Gallery Router - Agent-callable endpoints for gallery management.

Allows agent to:
- Add gallery items (images, videos, embeds)
- Trigger sitemap refresh
- Validate media assets
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from assistant_api.services.gallery_service import (
    add_gallery_item,
    run_sitemap_refresh,
    run_media_lint
)
from assistant_api.utils.cf_access import require_cf_access

router = APIRouter(
    prefix='/api/gallery',
    tags=['gallery'],
    dependencies=[Depends(require_cf_access)]
)


class AddItemRequest(BaseModel):
    """Request body for adding gallery item."""
    title: str
    description: str = ''
    type: str = Field(pattern=r'^(image|video-local|youtube|vimeo)$')
    src: str
    poster: Optional[str] = None
    mime: Optional[str] = None
    tools: Optional[list[str]] = None
    workflow: Optional[list[str]] = None
    tags: Optional[list[str]] = None


@router.post('/add')
async def add_card(body: AddItemRequest):
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

    return {
        'ok': True,
        'item': item,
        'lint_ok': lint_ok
    }
