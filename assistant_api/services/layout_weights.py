"""Weight management service for layout optimization."""
from __future__ import annotations
import json
import pathlib
from typing import Dict, Any, Optional

ACTIVE_PATH = pathlib.Path("data/layout_weights.active.json")
PROPOSED_PATH = pathlib.Path("data/layout_weights.proposed.json")


def _ensure_dir():
    """Ensure data directory exists."""
    ACTIVE_PATH.parent.mkdir(parents=True, exist_ok=True)


def read_active() -> Optional[Dict[str, float]]:
    """
    Read active weights from disk.

    Returns:
        Active weights dict or None if not set
    """
    _ensure_dir()
    if ACTIVE_PATH.exists():
        return json.loads(ACTIVE_PATH.read_text(encoding="utf-8"))
    return None


def read_proposed() -> Optional[Dict[str, float]]:
    """
    Read proposed weights from disk.

    Returns:
        Proposed weights dict or None if not set
    """
    _ensure_dir()
    if PROPOSED_PATH.exists():
        return json.loads(PROPOSED_PATH.read_text(encoding="utf-8"))
    return None


def propose_weights(weights: Dict[str, float]) -> Dict[str, Any]:
    """
    Save proposed weights for review.

    Args:
        weights: Weight dictionary {freshness, signal, fit, media}

    Returns:
        Dict with status and saved weights
    """
    _ensure_dir()
    PROPOSED_PATH.write_text(json.dumps(weights, indent=2), encoding="utf-8")
    return {"status": "proposed", "weights": weights}


def approve_weights() -> Dict[str, Any]:
    """
    Approve proposed weights and activate them.

    Returns:
        Dict with status and activated weights
    """
    _ensure_dir()
    if not PROPOSED_PATH.exists():
        return {"status": "error", "message": "No proposed weights to approve"}

    proposed = read_proposed()
    ACTIVE_PATH.write_text(json.dumps(proposed, indent=2), encoding="utf-8")
    PROPOSED_PATH.unlink()  # Remove proposed after approval

    return {"status": "approved", "weights": proposed}


def clear_proposed() -> Dict[str, Any]:
    """
    Clear proposed weights without activating.

    Returns:
        Dict with status
    """
    _ensure_dir()
    if PROPOSED_PATH.exists():
        PROPOSED_PATH.unlink()
    return {"status": "cleared"}
