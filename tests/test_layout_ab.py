"""Tests for A/B testing functionality."""
import pytest
from assistant_api.services.layout_ab import (
    assign_bucket,
    record_event,
    suggest_weights,
    reset_metrics
)


def test_bucket_assignment():
    """Test bucket assignment returns A or B."""
    bucket = assign_bucket()
    assert bucket in ("A", "B")


def test_consistent_bucket_assignment():
    """Test visitor_id produces consistent bucket."""
    visitor1 = "user123"
    bucket1 = assign_bucket(visitor1)
    bucket2 = assign_bucket(visitor1)

    # Same visitor should get same bucket
    assert bucket1 == bucket2


def test_different_visitors_get_buckets():
    """Test different visitors can get different buckets."""
    # With enough visitors, we should see both A and B
    buckets = set()
    for i in range(100):
        buckets.add(assign_bucket(f"visitor{i}"))

    # Should have both A and B assigned (statistically very likely)
    assert "A" in buckets
    assert "B" in buckets


def test_record_view_event():
    """Test recording view events."""
    reset_metrics()  # Start fresh

    state1 = record_event("A", "view")
    assert state1["metrics"]["A"]["views"] == 1
    assert state1["metrics"]["A"]["clicks"] == 0

    state2 = record_event("A", "view")
    assert state2["metrics"]["A"]["views"] == 2


def test_record_click_event():
    """Test recording click events."""
    reset_metrics()  # Start fresh

    state1 = record_event("B", "click")
    assert state1["metrics"]["B"]["clicks"] == 1
    assert state1["metrics"]["B"]["views"] == 0

    state2 = record_event("B", "click")
    assert state2["metrics"]["B"]["clicks"] == 2


def test_record_mixed_events():
    """Test recording multiple event types."""
    reset_metrics()  # Start fresh

    record_event("A", "view")
    record_event("A", "view")
    record_event("A", "click")
    state = record_event("A", "view")

    assert state["metrics"]["A"]["views"] == 3
    assert state["metrics"]["A"]["clicks"] == 1


def test_suggest_weights_structure():
    """Test suggest_weights returns expected structure."""
    reset_metrics()  # Start fresh

    # Record some events
    record_event("A", "view")
    record_event("A", "view")
    record_event("A", "click")
    record_event("B", "view")
    record_event("B", "view")
    record_event("B", "view")
    record_event("B", "click")

    result = suggest_weights()

    assert "better" in result
    assert result["better"] in ("A", "B")
    assert "ctr_a" in result
    assert "ctr_b" in result
    assert "hint" in result
    assert "metrics" in result

    # Check hint structure
    hint = result["hint"]
    assert "freshness" in hint
    assert "signal" in hint
    assert "fit" in hint
    assert "media" in hint


def test_suggest_weights_ctr_calculation():
    """Test CTR calculation in suggestions."""
    reset_metrics()  # Start fresh

    # A: 1 click out of 2 views = 50% CTR
    record_event("A", "view")
    record_event("A", "view")
    record_event("A", "click")

    # B: 1 click out of 4 views = 25% CTR
    record_event("B", "view")
    record_event("B", "view")
    record_event("B", "view")
    record_event("B", "view")
    record_event("B", "click")

    result = suggest_weights()

    assert result["better"] == "A"  # A has higher CTR
    assert result["ctr_a"] == 0.5
    assert result["ctr_b"] == 0.25


def test_suggest_weights_different_hints():
    """Test that different winners produce different hints."""
    # Test A wins scenario
    reset_metrics()
    record_event("A", "view")
    record_event("A", "click")
    record_event("B", "view")
    result_a = suggest_weights()

    # Test B wins scenario
    reset_metrics()
    record_event("A", "view")
    record_event("B", "view")
    record_event("B", "click")
    result_b = suggest_weights()

    # Different winners should give different hints
    if result_a["better"] != result_b["better"]:
        assert result_a["hint"] != result_b["hint"]


def test_reset_metrics():
    """Test metrics reset."""
    # Record some events
    record_event("A", "view")
    record_event("A", "click")
    record_event("B", "view")

    # Reset
    state = reset_metrics()

    assert state["metrics"]["A"]["views"] == 0
    assert state["metrics"]["A"]["clicks"] == 0
    assert state["metrics"]["B"]["views"] == 0
    assert state["metrics"]["B"]["clicks"] == 0


def test_state_persistence():
    """Test that state persists across function calls."""
    reset_metrics()

    record_event("A", "view")
    state1 = record_event("A", "click")

    # Next call should see previous state
    state2 = record_event("A", "view")

    assert state2["metrics"]["A"]["views"] == 2
    assert state2["metrics"]["A"]["clicks"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
