"""Layout weights management router."""

from typing import Dict

from fastapi import APIRouter, Body

from ..services.layout_weights import (
    approve_weights,
    clear_proposed,
    propose_weights,
    read_active,
    read_proposed,
)

router = APIRouter(prefix="/agent/layout", tags=["layout-weights"])


@router.get("/weights")
def get_weights():
    """
    Get current active and proposed weights.

    Returns:
        Dict with active and proposed weights
    """
    return {"active": read_active(), "proposed": read_proposed()}


@router.post("/weights/propose")
def propose(weights: dict[str, float] = Body(...)):
    """
    Propose new weights for approval.

    Args:
        weights: Weight dictionary {freshness, signal, fit, media}

    Returns:
        Dict with status and saved weights
    """
    return propose_weights(weights)


@router.post("/weights/approve")
def approve():
    """
    Approve proposed weights and activate them.

    Returns:
        Dict with status and activated weights
    """
    return approve_weights()


@router.post("/weights/clear")
def clear():
    """
    Clear proposed weights without activating.

    Returns:
        Dict with status
    """
    return clear_proposed()
