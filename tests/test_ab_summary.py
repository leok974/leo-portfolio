"""Tests for A/B event store and analytics."""
import pytest
import tempfile
import pathlib
from assistant_api.services.ab_store import append_event, summary, iter_events


@pytest.fixture
def tmp_store(monkeypatch):
    """Use temporary directory for test event storage."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = pathlib.Path(tmpdir)
        monkeypatch.setattr("assistant_api.services.ab_store.DATA_DIR", tmp_path)
        monkeypatch.setattr("assistant_api.services.ab_store.EVENTS", tmp_path / "ab_events.jsonl")
        yield tmp_path


def test_append_and_iter_events(tmp_store):
    """Test event logging and retrieval."""
    # Add some events
    append_event("A", "view", ts=1700000000)
    append_event("A", "click", ts=1700000001)
    append_event("B", "view", ts=1700000002)

    # Verify events can be retrieved
    events = list(iter_events())
    assert len(events) == 3
    assert events[0]["bucket"] == "A"
    assert events[0]["event"] == "view"
    assert events[1]["event"] == "click"


def test_daily_ctr_series(tmp_store):
    """Test daily CTR aggregation."""
    # Add events on same day (2023-11-15)
    ts_base = 1700000000  # 2023-11-15

    # Bucket A: 2 views, 1 click (50% CTR)
    append_event("A", "view", ts=ts_base)
    append_event("A", "view", ts=ts_base + 10)
    append_event("A", "click", ts=ts_base + 20)

    # Bucket B: 3 views, 0 clicks (0% CTR)
    append_event("B", "view", ts=ts_base)
    append_event("B", "view", ts=ts_base + 15)
    append_event("B", "view", ts=ts_base + 25)

    # Get summary
    s = summary()

    # Check overall stats
    assert s["overall"]["A_ctr"] > s["overall"]["B_ctr"]
    assert s["overall"]["A"]["views"] == 2
    assert s["overall"]["A"]["clicks"] == 1
    assert s["overall"]["B"]["views"] == 3
    assert s["overall"]["B"]["clicks"] == 0

    # Check series
    assert len(s["series"]) == 1
    assert s["series"][0]["A_ctr"] == 0.5  # 1/2
    assert s["series"][0]["B_ctr"] == 0.0  # 0/3


def test_date_filtering(tmp_store):
    """Test summary with date range filters."""
    # Add events across multiple days
    append_event("A", "view", ts=1700000000)  # 2023-11-14
    append_event("A", "click", ts=1700000000)
    append_event("B", "view", ts=1700086400)  # 2023-11-15
    append_event("B", "click", ts=1700086400)

    # Filter to only first day
    s = summary(from_day="2023-11-14", to_day="2023-11-14")
    assert len(s["series"]) == 1
    assert s["series"][0]["day"] == "2023-11-14"
    assert s["overall"]["A"]["views"] == 1
    assert s["overall"]["B"]["views"] == 0


def test_empty_store(tmp_store):
    """Test summary with no events."""
    s = summary()
    assert s["series"] == []
    assert s["overall"]["days"] == 0
    assert s["overall"]["A_ctr"] == 0.0
    assert s["overall"]["B_ctr"] == 0.0
