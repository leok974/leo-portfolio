"""Tests for events endpoint filtering."""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    """Create a test client with clean environment."""
    monkeypatch.setenv("SITEAGENT_HMAC_SECRET", "test-hmac-default")
    from assistant_api.main import app
    return TestClient(app)


def test_events_endpoint_exists(client):
    """Test that events endpoint is accessible."""
    r = client.get("/agent/events")
    assert r.status_code == 200
    j = r.json()
    assert "events" in j
    assert isinstance(j["events"], list)


def test_events_accepts_level_filter(client):
    """Test that events endpoint accepts level parameter."""
    r = client.get("/agent/events?level=info")
    assert r.status_code == 200
    j = r.json()
    assert "events" in j


def test_events_accepts_run_filter(client):
    """Test that events endpoint accepts run_id parameter."""
    r = client.get("/agent/events?run_id=abc123")
    assert r.status_code == 200
    j = r.json()
    assert "events" in j


def test_events_accepts_task_filter(client):
    """Test that events endpoint accepts task parameter."""
    r = client.get("/agent/events?task=links.apply")
    assert r.status_code == 200
    j = r.json()
    assert "events" in j


def test_events_accepts_limit(client):
    """Test that events endpoint accepts limit parameter."""
    r = client.get("/agent/events?limit=5")
    assert r.status_code == 200
    j = r.json()
    assert "events" in j
    assert len(j["events"]) <= 5


def test_events_all_filters_combined(client):
    """Test that events endpoint accepts all filters together."""
    r = client.get("/agent/events?level=info&task=links.apply&run_id=test&limit=10")
    assert r.status_code == 200
    j = r.json()
    assert "events" in j
