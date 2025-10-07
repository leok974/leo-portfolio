"""Test sticky A/B assignment with deterministic bucketing."""
import pytest
from assistant_api.services.layout_ab import assign_bucket


def test_sticky_assignment():
    """Test that same visitor_id always returns same bucket."""
    visitor_id = "test-visitor-123"

    # Call multiple times with same visitor_id
    bucket1 = assign_bucket(visitor_id)
    bucket2 = assign_bucket(visitor_id)
    bucket3 = assign_bucket(visitor_id)

    # All should be identical
    assert bucket1 == bucket2
    assert bucket2 == bucket3
    assert bucket1 in ("A", "B")


def test_different_visitors_different_buckets():
    """Test that different visitor_ids can get different buckets."""
    # Test enough visitors to ensure we get both A and B
    buckets = set()
    for i in range(100):
        bucket = assign_bucket(f"visitor-{i}")
        buckets.add(bucket)

    # Should have both A and B in the set
    assert "A" in buckets
    assert "B" in buckets


def test_no_visitor_id_random():
    """Test that without visitor_id, assignment is random (not necessarily different)."""
    # Without visitor_id, we can't guarantee stickiness
    bucket = assign_bucket(None)
    assert bucket in ("A", "B")
