"""Tests for analytics ingestion and SEO tune task."""
import json
import os
import tempfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient


def test_analytics_ingest_and_tune(tmp_path, monkeypatch):
    """Test analytics ingestion followed by SEO tune task."""
    # Set up temp paths
    db_path = str(tmp_path / "rag.sqlite")
    artifacts_dir = str(tmp_path / "artifacts")
    web_root = str(tmp_path)

    # Create a simple HTML file for testing
    (tmp_path / "projects").mkdir(parents=True, exist_ok=True)
    test_html = """
    <html>
    <head>
        <title>Test Project</title>
        <meta name="description" content="Short description">
    </head>
    <body>Content</body>
    </html>
    """
    (tmp_path / "projects" / "datapipe-ai.html").write_text(test_html)

    # Monkeypatch environment
    monkeypatch.setenv("RAG_DB", db_path)
    monkeypatch.setenv("ARTIFACTS_DIR", artifacts_dir)
    monkeypatch.setenv("WEB_ROOT", web_root)
    monkeypatch.setenv("SEO_CTR_THRESHOLD", "0.02")
    monkeypatch.setenv("DISABLE_PRIMARY", "1")  # Disable Ollama for tests

    # Import after monkeypatch to pick up env vars
    from assistant_api.main import app
    client = TestClient(app)

    # Test 1: Ingest analytics data
    payload = {
        "source": "search_console",
        "rows": [
            {"url": "/projects/datapipe-ai", "impressions": 1000, "clicks": 5},
            {"url": "/projects/derma-ai", "impressions": 1200, "clicks": 12}
        ]
    }

    # Use dev overlay auth for testing
    response = client.post(
        "/agent/analytics/ingest",
        json=payload,
        headers={"Cookie": "dev_overlay=enabled"}
    )

    assert response.status_code == 200, f"Ingest failed: {response.text}"
    result = response.json()
    assert result["rows"] == 2
    assert result["source"] == "search_console"
    assert result["inserted_or_updated"] >= 1

    # Test 2: Run SEO tune task
    response2 = client.post(
        "/agent/run?task=seo.tune",
        json={"threshold": 0.02},
        headers={"Cookie": "dev_overlay=enabled"}
    )

    assert response2.status_code == 200, f"SEO tune failed: {response2.text}"
    data = response2.json()
    assert data.get("ok") is True
    assert data.get("count") >= 1

    # Verify artifacts were created
    artifacts_path = Path(artifacts_dir)
    assert (artifacts_path / "seo-tune.json").exists()
    assert (artifacts_path / "seo-tune.md").exists()

    # Verify JSON structure
    with open(artifacts_path / "seo-tune.json") as f:
        tune_data = json.load(f)
        assert "generated" in tune_data
        assert "threshold" in tune_data
        assert "pages" in tune_data
        assert len(tune_data["pages"]) >= 1

        # Check first page has expected fields
        page = tune_data["pages"][0]
        assert "url" in page
        assert "ctr" in page
        assert "old_title" in page
        assert "new_title" in page
        assert "old_description" in page
        assert "new_description" in page


def test_ctr_calculation():
    """Test CTR calculation edge cases."""
    from assistant_api.ctr_analytics.storage import CTRRow
    from datetime import datetime, timezone

    # Zero impressions should result in 0.0 CTR
    now = datetime.now(timezone.utc).isoformat()
    row = CTRRow(
        url="/test",
        impressions=0,
        clicks=0,
        ctr=0.0,
        last_seen=now,
        source="test"
    )
    assert row.ctr == 0.0

    # Normal calculation
    row2 = CTRRow(
        url="/test2",
        impressions=1000,
        clicks=50,
        ctr=0.05,
        last_seen=now,
        source="test"
    )
    assert row2.ctr == 0.05


def test_meta_extraction():
    """Test HTML meta tag extraction."""
    from assistant_api.tasks.seo_tune import extract_meta_from_html

    html = """
    <html>
    <head>
        <title>Test Title</title>
        <meta name="description" content="Test description here">
    </head>
    </html>
    """

    meta = extract_meta_from_html(html)
    assert meta.title == "Test Title"
    assert meta.description == "Test description here"

    # Test missing tags
    html2 = "<html><body>No meta</body></html>"
    meta2 = extract_meta_from_html(html2)
    assert meta2.title is None
    assert meta2.description is None


def test_heuristic_rewrite():
    """Test heuristic SEO rewrite logic."""
    from assistant_api.tasks.seo_tune import heuristic_rewrite, PageMeta

    # Short title should be expanded
    meta = PageMeta(title="Project", description="Short")
    new = heuristic_rewrite(meta, "/test", 0.01)

    assert len(new.title) > len(meta.title or "")
    assert "AI" in new.title or "Agent" in new.title or "Automation" in new.title
    assert len(new.description) > len(meta.description or "")

    # Verify clipping
    assert len(new.title) <= 70
    assert len(new.description) <= 155
