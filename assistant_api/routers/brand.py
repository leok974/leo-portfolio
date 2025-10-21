"""
Brand asset generation endpoints.

Provides tools for generating business cards, social banners, and other
branded assets using Figma templates and MCP integration.

All endpoints require admin authentication (CF Access or dev HMAC).
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from ..security.cf_access import require_cf_access
from ..services.mcp import figma_tools


router = APIRouter(
    prefix="/agent/brand",
    tags=["brand"],
    dependencies=[Depends(require_cf_access)]
)


class CardRequest(BaseModel):
    """Business card generation request."""
    name: str = Field(..., description="Full name to display on card")
    role: str = Field(..., description="Job title or role")
    email: str = Field(..., description="Contact email address")
    domain: str = Field(..., description="Website domain")
    qr_url: Optional[str] = Field(None, description="URL for QR code (defaults to domain)")


class CardResponse(BaseModel):
    """Business card generation response."""
    ok: bool = True
    file_key: str = Field(..., description="Figma file key for generated card")
    export: dict = Field(..., description="Export URLs/paths for PNG and PDF")


@router.post("/card", response_model=CardResponse)
async def generate_card(req: CardRequest):
    """
    Generate business card from Figma template.

    **Flow:**
    1. Duplicate template file (FIGMA_TEMPLATE_KEY)
    2. Inject metadata into placeholders: {name}, {role}, {email}, {domain}, {qr_code}
    3. Export CardFront and CardBack nodes as PNG and PDF
    4. Save to agent/artifacts/cards/ with metadata JSON

    **Required env vars:**
    - FIGMA_PAT: Personal access token
    - FIGMA_TEMPLATE_KEY: Template file key

    **Returns:**
    - file_key: New Figma file key (for "Open in Figma" link)
    - export: Dict with png and pdf artifact paths
    """
    try:
        # Step 1: Generate card (duplicate template + inject variables)
        file_key = await figma_tools.generate_card(req.model_dump())

        # Step 2: Export nodes
        export = await figma_tools.export_nodes(
            file_key=file_key,
            node_ids=["CardFront", "CardBack"],
            fmt="png"
        )

        # TODO: Also export PDF version
        # TODO: Save metadata JSON to agent/artifacts/cards/{timestamp}_meta.json

        return CardResponse(
            ok=True,
            file_key=file_key,
            export=export
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Card generation failed: {str(e)}")


@router.get("/templates")
async def list_templates():
    """
    List available brand asset templates.

    **Returns:**
    - List of template metadata (name, type, file_key, preview_url)

    TODO: Implement template registry (could be JSON file or DB table)
    """
    return {
        "ok": True,
        "templates": [
            {
                "id": "business_card",
                "name": "Business Card",
                "type": "card",
                "file_key": figma_tools.FIGMA_TEMPLATE_KEY,
                "preview_url": None
            }
        ]
    }


@router.get("/tokens")
async def get_design_tokens():
    """
    Get design tokens from Figma design system.

    **Returns:**
    - colors: Color palette with semantic names
    - typography: Font families, sizes, weights
    - spacing: Spacing scale

    TODO: Call figma_tools.export_tokens() and cache result
    """
    try:
        # TODO: Get file_key from env var or registry
        # tokens = await figma_tools.export_tokens(file_key="...")
        return {
            "ok": True,
            "tokens": {
                "colors": {},
                "typography": {},
                "spacing": {}
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/audit/{file_key}")
async def audit_design_file(file_key: str):
    """
    Audit Figma file for design system compliance.

    **Args:**
    - file_key: Figma file key to audit

    **Returns:**
    - Audit report with counts of components, untyped text, non-token colors

    TODO: Integrate with analytics for design quality tracking
    """
    try:
        audit = await figma_tools.audit_file(file_key)
        return {
            "ok": True,
            "file_key": file_key,
            "audit": audit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
