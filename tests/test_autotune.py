"""Tests for adaptive weight autotuning (Phase 50.3)."""
import pytest
from assistant_api.services.weights_autotune import _apply_hint


def test_apply_hint_normalizes():
    """Test that hint application normalizes weights to sum=1.0."""
    base = {"freshness": 0.35, "signal": 0.35, "fit": 0.2, "media": 0.1}
    hint = {"signal": +0.05, "media": -0.1, "fit": +0.02, "freshness": +0.03}

    out = _apply_hint(base, hint, alpha=0.5)

    # Should sum to 1.0
    assert abs(sum(out.values()) - 1.0) < 1e-6

    # All values should be non-negative
    assert all(v >= 0 for v in out.values())


def test_apply_hint_respects_alpha():
    """Test that learning rate alpha controls adjustment magnitude."""
    base = {"freshness": 0.25, "signal": 0.25, "fit": 0.25, "media": 0.25}
    hint = {"signal": +0.1, "freshness": -0.05, "fit": 0.0, "media": 0.0}

    # Low alpha = small change
    out_low = _apply_hint(base, hint, alpha=0.1)

    # High alpha = large change
    out_high = _apply_hint(base, hint, alpha=1.0)

    # Signal should increase more with high alpha
    signal_change_low = out_low["signal"] - base["signal"]
    signal_change_high = out_high["signal"] - base["signal"]

    assert signal_change_high > signal_change_low


def test_apply_hint_nonnegative():
    """Test that weights stay non-negative even with large negative hints."""
    base = {"freshness": 0.1, "signal": 0.3, "fit": 0.3, "media": 0.3}
    hint = {"freshness": -0.5, "signal": 0.0, "fit": 0.0, "media": 0.0}  # Large negative

    out = _apply_hint(base, hint, alpha=1.0)

    # Freshness should be clamped to 0, not go negative
    assert out["freshness"] >= 0.0

    # Others should still sum with freshness to 1.0
    assert abs(sum(out.values()) - 1.0) < 1e-6


def test_apply_hint_zero_alpha():
    """Test that alpha=0 leaves weights unchanged (normalized)."""
    base = {"freshness": 0.3, "signal": 0.3, "fit": 0.2, "media": 0.2}
    hint = {"signal": +0.5, "freshness": -0.5, "fit": 0.0, "media": 0.0}

    out = _apply_hint(base, hint, alpha=0.0)

    # With alpha=0, should be identical to base (within rounding)
    for k in base:
        assert abs(out[k] - base[k]) < 1e-6
