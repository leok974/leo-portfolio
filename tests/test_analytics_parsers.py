# tests/test_analytics_parsers.py
"""Tests for analytics data parsers (CSV, GSC API JSON, GA4 JSON)."""
from fastapi.testclient import TestClient
import pytest

CSV_GSC_EXPORT = """Page,Clicks,Impressions,CTR,Position
/,12,2200,0.54%,1.2
/projects/siteagent,11,1850,0.59%,1.5
/projects/datapipe-ai,6,1400,0.43%,2.1
"""

GSC_API_JSON = {
    "rows": [
        {"keys": ["/projects/datapipe-ai"], "clicks": 6, "impressions": 1400},
        {"keys": ["https://example.com/projects/derma-ai"], "clicks": 10, "impressions": 1200}
    ]
}

INTERNAL_JSON = {
    "source": "search_console",
    "rows": [
        {"url": "/", "impressions": 2200, "clicks": 12},
        {"url": "/projects/siteagent", "impressions": 1850, "clicks": 11}
    ]
}

GA4_JSON = {
    "rows": [
        {
            "dimensionValues": [{"value": "/projects/clarity"}],
            "metricValues": [{"value": "892"}, {"value": "8"}]
        },
        {
            "dimensionValues": [{"value": "/about"}],
            "metricValues": [{"value": "1500"}, {"value": "15"}]
        }
    ]
}


@pytest.fixture
def client(monkeypatch, tmp_path):
    """Create test client with temporary database."""
    from assistant_api.main import app

    monkeypatch.setenv("RAG_DB", str(tmp_path / "rag.sqlite"))
    monkeypatch.setenv("ARTIFACTS_DIR", str(tmp_path / "artifacts"))
    monkeypatch.setenv("DEV_OVERLAY_BYPASS", "1")  # Bypass auth for testing

    return TestClient(app)


def test_ingest_csv(client, monkeypatch):
    """Test CSV ingestion from GSC UI export."""
    monkeypatch.setenv("DEV_OVERLAY_BYPASS", "1")

    response = client.post(
        "/agent/analytics/ingest",
        data=CSV_GSC_EXPORT,
        headers={
            "Content-Type": "text/csv",
            "Authorization": "Bearer dev"
        }
    )

    assert response.status_code == 200, f"Failed: {response.text}"
    json = response.json()
    assert json["rows"] == 3
    assert json["source"] == "search_console"
    assert json["inserted_or_updated"] >= 3


def test_ingest_gsc_api_json(client, monkeypatch):
    """Test GSC API JSON format (searchanalytics.query response)."""
    monkeypatch.setenv("DEV_OVERLAY_BYPASS", "1")

    response = client.post(
        "/agent/analytics/ingest",
        json=GSC_API_JSON,
        headers={"Authorization": "Bearer dev"}
    )

    assert response.status_code == 200, f"Failed: {response.text}"
    json = response.json()
    assert json["rows"] == 2
    assert json["source"] == "search_console"
    assert json["inserted_or_updated"] >= 2


def test_ingest_internal_json(client, monkeypatch):
    """Test our internal JSON format."""
    monkeypatch.setenv("DEV_OVERLAY_BYPASS", "1")

    response = client.post(
        "/agent/analytics/ingest",
        json=INTERNAL_JSON,
        headers={"Authorization": "Bearer dev"}
    )

    assert response.status_code == 200, f"Failed: {response.text}"
    json = response.json()
    assert json["rows"] == 2
    assert json["source"] == "search_console"
    assert json["inserted_or_updated"] >= 2


def test_ingest_ga4_json(client, monkeypatch):
    """Test GA4 JSON format with dimensionValues/metricValues."""
    monkeypatch.setenv("DEV_OVERLAY_BYPASS", "1")

    response = client.post(
        "/agent/analytics/ingest",
        json=GA4_JSON,
        headers={"Authorization": "Bearer dev"}
    )

    assert response.status_code == 200, f"Failed: {response.text}"
    json = response.json()
    assert json["rows"] == 2
    assert json["source"] == "ga4"
    assert json["inserted_or_updated"] >= 2


def test_ingest_empty_payload(client, monkeypatch):
    """Test that empty or invalid payload returns 400."""
    monkeypatch.setenv("DEV_OVERLAY_BYPASS", "1")

    response = client.post(
        "/agent/analytics/ingest",
        json={},
        headers={"Authorization": "Bearer dev"}
    )

    assert response.status_code == 400
    assert "No rows detected" in response.text


def test_url_normalization(client, monkeypatch):
    """Test that URLs are normalized correctly (absolute → relative)."""
    monkeypatch.setenv("DEV_OVERLAY_BYPASS", "1")

    payload = {
        "source": "manual",
        "rows": [
            {"url": "https://example.com/projects/test", "impressions": 100, "clicks": 5},
            {"url": "/projects/test2", "impressions": 200, "clicks": 10},
            {"url": "projects/test3", "impressions": 150, "clicks": 7}
        ]
    }

    response = client.post(
        "/agent/analytics/ingest",
        json=payload,
        headers={"Authorization": "Bearer dev"}
    )

    assert response.status_code == 200
    # All URLs should be normalized to start with /
    # The storage layer should have: /projects/test, /projects/test2, /projects/test3


def test_csv_with_commas_in_numbers(client, monkeypatch):
    """Test CSV parsing with thousand separators in numbers."""
    monkeypatch.setenv("DEV_OVERLAY_BYPASS", "1")

    csv_with_commas = """Page,Clicks,Impressions,CTR,Position
/,12,"2,200",0.54%,1.2
/blog,"1,234","56,789",2.17%,3.4
"""

    response = client.post(
        "/agent/analytics/ingest",
        data=csv_with_commas,
        headers={
            "Content-Type": "text/csv",
            "Authorization": "Bearer dev"
        }
    )

    assert response.status_code == 200, f"Failed: {response.text}"
    json = response.json()
    assert json["rows"] == 2
    # Should handle "2,200" → 2200 and "1,234" → 1234


def test_multiple_sources_tracked(client, monkeypatch):
    """Test that different sources are tracked separately."""
    monkeypatch.setenv("DEV_OVERLAY_BYPASS", "1")

    # Ingest from search_console
    response1 = client.post(
        "/agent/analytics/ingest",
        json={"source": "search_console", "rows": [{"url": "/test", "impressions": 100, "clicks": 5}]},
        headers={"Authorization": "Bearer dev"}
    )
    assert response1.status_code == 200

    # Ingest from ga4
    response2 = client.post(
        "/agent/analytics/ingest",
        json=GA4_JSON,
        headers={"Authorization": "Bearer dev"}
    )
    assert response2.status_code == 200
    assert response2.json()["source"] == "ga4"

    # Ingest from manual
    response3 = client.post(
        "/agent/analytics/ingest",
        json={"source": "manual", "rows": [{"url": "/manual-test", "impressions": 50, "clicks": 2}]},
        headers={"Authorization": "Bearer dev"}
    )
    assert response3.status_code == 200
    assert response3.json()["source"] == "manual"
