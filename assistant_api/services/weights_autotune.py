"""
Adaptive Agentic Feedback Loop (Phase 50.3)

Automatically tunes layout weights based on A/B testing results.
"""
from __future__ import annotations

from typing import Dict

from .agent_events import log_event
from .layout_ab import suggest_weights
from .layout_opt import run_layout_optimize
from .layout_weights import approve_weights, propose_weights, read_active


def _apply_hint(
    base: dict[str, float],
    hint: dict[str, float],
    alpha: float = 1.0
) -> dict[str, float]:
    """
    Apply A/B testing hint to base weights with learning rate alpha.

    Args:
        base: Current weights (freshness, signal, fit, media)
        hint: Suggested adjustments from A/B testing
        alpha: Learning rate (0-1). Higher = more aggressive tuning.

    Returns:
        Normalized weights (sum to 1.0, all >= 0)
    """
    # Apply hint with learning rate
    out = {}
    for k in {"freshness", "signal", "fit", "media"}:
        base_val = base.get(k, 0.0)
        hint_val = hint.get(k, 0.0)
        out[k] = max(0.0, base_val + alpha * hint_val)

    # Normalize to sum to 1.0
    total = sum(out.values()) or 1.0
    return {k: v / total for k, v in out.items()}


def run_autotune(alpha: float = 0.5) -> dict:
    """
    Run adaptive weight tuning based on A/B test results.

    Process:
    1. Read current active weights
    2. Get A/B testing suggestions (winner, CTR, hints)
    3. Apply hints with learning rate alpha
    4. Save and approve new weights
    5. Run layout optimization with new weights
    6. Log event for audit trail

    Args:
        alpha: Learning rate (0-1). Default 0.5 for gradual tuning.
               Set higher (0.8-1.0) for aggressive tuning.

    Returns:
        Dict with status, message, new weights, and optimization result
    """
    # Get current state
    base_weights = read_active()
    ab_suggestion = suggest_weights()

    # Apply hint
    new_weights = _apply_hint(base_weights, ab_suggestion["hint"], alpha=alpha)

    # Activate new weights
    propose_weights(new_weights)
    approve_weights()

    # Optimize with new weights
    opt_result = run_layout_optimize({"weights": new_weights})

    # Build status message
    winner = ab_suggestion["better"]
    ctr_a = ab_suggestion["ctrA"]
    ctr_b = ab_suggestion["ctrB"]
    summary = opt_result.get("summary", "No summary available")

    message = (
        f"Auto-tuned weights (α={alpha}): {new_weights}; "
        f"winner={winner} (A={ctr_a:.2%}, B={ctr_b:.2%}). {summary}"
    )

    # Log for audit
    log_event("autotune.optimize", {
        "alpha": alpha,
        "winner": winner,
        "ctr_a": ctr_a,
        "ctr_b": ctr_b,
        "old_weights": base_weights,
        "new_weights": new_weights,
        "summary": summary
    })

    return {
        "ok": True,
        "message": message,
        "weights": new_weights,
        "ab_suggestion": ab_suggestion,
        "optimize": opt_result
    }
