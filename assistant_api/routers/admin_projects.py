"""
Admin Projects Router

Provides endpoints to hide/unhide projects by updating projects.hidden.json.
Protected by ADMIN_HMAC_KEY environment variable.
"""

from fastapi import APIRouter, HTTPException, Header
from pathlib import Path
from pydantic import BaseModel
import json
import os

# Configuration
ROUTE_KEY = os.getenv("ADMIN_HMAC_KEY", "")
HIDDEN_PATH = Path(__file__).resolve().parents[3] / "apps" / "portfolio-ui" / "public" / "projects.hidden.json"

router = APIRouter(prefix="/api/admin/projects", tags=["admin-projects"])


class ProjectSlugPayload(BaseModel):
    slug: str


def check_auth(x_admin_key: str | None):
    """Verify admin key from header"""
    if not ROUTE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Admin endpoints not configured (ADMIN_HMAC_KEY not set)"
        )
    if not x_admin_key or x_admin_key != ROUTE_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


def load_hidden_list() -> list[str]:
    """Load current hidden projects list"""
    if not HIDDEN_PATH.exists():
        return []
    try:
        return json.loads(HIDDEN_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Warning: Failed to load hidden list: {e}")
        return []


def save_hidden_list(items: list[str]) -> None:
    """Save hidden projects list to disk"""
    HIDDEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    HIDDEN_PATH.write_text(json.dumps(items, indent=2), encoding="utf-8")


@router.post("/hide")
def hide_project(
    payload: ProjectSlugPayload,
    x_admin_key: str | None = Header(default=None)
):
    """
    Hide a project by adding its slug to projects.hidden.json
    
    Requires x-admin-key header matching ADMIN_HMAC_KEY env var.
    """
    check_auth(x_admin_key)
    
    slug = payload.slug.strip()
    if not slug:
        raise HTTPException(status_code=400, detail="slug required")
    
    items = load_hidden_list()
    slug_lower = slug.lower()
    
    # Check if already hidden
    if any(s.lower() == slug_lower for s in items):
        return {
            "ok": True,
            "message": f"Project '{slug}' already hidden",
            "hidden": items
        }
    
    # Add to hidden list
    items.append(slug)
    save_hidden_list(items)
    
    return {
        "ok": True,
        "message": f"Project '{slug}' hidden successfully",
        "hidden": items
    }


@router.post("/unhide")
def unhide_project(
    payload: ProjectSlugPayload,
    x_admin_key: str | None = Header(default=None)
):
    """
    Unhide a project by removing its slug from projects.hidden.json
    
    Requires x-admin-key header matching ADMIN_HMAC_KEY env var.
    """
    check_auth(x_admin_key)
    
    slug = payload.slug.strip()
    if not slug:
        raise HTTPException(status_code=400, detail="slug required")
    
    items = load_hidden_list()
    slug_lower = slug.lower()
    
    # Filter out the slug (case-insensitive)
    original_count = len(items)
    items = [s for s in items if s.lower() != slug_lower]
    
    if len(items) == original_count:
        return {
            "ok": True,
            "message": f"Project '{slug}' was not hidden",
            "hidden": items
        }
    
    save_hidden_list(items)
    
    return {
        "ok": True,
        "message": f"Project '{slug}' unhidden successfully",
        "hidden": items
    }


@router.get("/hidden")
def get_hidden_projects(x_admin_key: str | None = Header(default=None)):
    """
    Get list of currently hidden projects
    
    Requires x-admin-key header matching ADMIN_HMAC_KEY env var.
    """
    check_auth(x_admin_key)
    
    items = load_hidden_list()
    return {
        "ok": True,
        "hidden": items,
        "count": len(items)
    }
