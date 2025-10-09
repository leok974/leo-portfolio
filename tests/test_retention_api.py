"""Tests for on-demand retention endpoint (POST /agent/metrics/retention/run)."""

from datetime import datetime, timedelta, timezone
from pathlib import Path
from fastapi.testclient import TestClient
from assistant_api.main import app

client = TestClient(app)


def _touch_event_file(base: Path, day: datetime, data: str = '{"type":"view"}\n'):
    """Helper: create events-YYYYMMDD.jsonl with data."""
    fname = f"events-{day.strftime('%Y%m%d')}.jsonl"
    (base / fname).write_text(data, encoding="utf-8")


def test_retention_run_guarded(tmp_path, monkeypatch):
    """Test POST /agent/metrics/retention/run is guarded and compresses/prunes files."""
    # Setup temp analytics dir
    analytics_dir = tmp_path / "analytics"
    analytics_dir.mkdir()

    # Create test files
    today = datetime.now(timezone.utc)
    old = today - timedelta(days=10)  # Should compress
    ancient = today - timedelta(days=100)  # Should delete

    _touch_event_file(analytics_dir, today, '{"type":"view"}\n')
    _touch_event_file(analytics_dir, old, '{"type":"click"}\n')
    _touch_event_file(analytics_dir, ancient, '{"type":"old"}\n')

    # Configure environment
    monkeypatch.setenv("ANALYTICS_DIR", str(analytics_dir))
    monkeypatch.setenv("ANALYTICS_RETENTION_DAYS", "90")
    monkeypatch.setenv("ANALYTICS_GZIP_AFTER_DAYS", "7")
    monkeypatch.setenv("METRICS_DEV_TOKEN", "test-token-123")

    # Test 1: No token → 401
    resp = client.post("/agent/metrics/retention/run")
    assert resp.status_code == 401

    # Test 2: Wrong token → 403
    resp = client.post("/agent/metrics/retention/run",
                      headers={"Authorization": "Bearer wrong-token"})
    assert resp.status_code == 403

    # Test 3: Valid token → 200 with stats
    resp = client.post("/agent/metrics/retention/run",
                      headers={"Authorization": "Bearer test-token-123"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "scanned" in data
    assert "compressed" in data
    assert "removed" in data
    assert "dir" in data

    # Verify compression happened (old file should be .gz now)
    old_file = analytics_dir / f"events-{old.strftime('%Y%m%d')}.jsonl"
    old_gz = analytics_dir / f"events-{old.strftime('%Y%m%d')}.jsonl.gz"
    assert not old_file.exists(), "Old file should be compressed"
    assert old_gz.exists(), "Compressed file should exist"

    # Verify ancient file removed
    ancient_file = analytics_dir / f"events-{ancient.strftime('%Y%m%d')}.jsonl"
    assert not ancient_file.exists(), "Ancient file should be deleted"

    # Verify today's file unchanged (too recent)
    today_file = analytics_dir / f"events-{today.strftime('%Y%m%d')}.jsonl"
    assert today_file.exists(), "Today's file should remain uncompressed"
    assert not (analytics_dir / f"events-{today.strftime('%Y%m%d')}.jsonl.gz").exists()
