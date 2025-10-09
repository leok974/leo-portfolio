"""
Test SEO tune LLM fallback behavior.

Verifies that when LLM endpoints are unreachable, the system gracefully
falls back to heuristic rewrites without failing.
"""
import os
import json
import tempfile
from pathlib import Path
from assistant_api.ctr_analytics.storage import ensure_tables, upsert_ctr_rows, CTRRow
from assistant_api.tasks.seo_tune import run
from datetime import datetime, timezone


def test_seo_tune_llm_fallback_to_heuristic(tmp_path, monkeypatch):
    """
    Test that seo.tune falls back to heuristic when LLM endpoints are unreachable.
    """
    # Point env at temp paths and disable real LLM by pointing to an unusable port
    db_path = str(tmp_path / "rag.sqlite")
    artifacts_dir = str(tmp_path / "artifacts")
    web_root = str(tmp_path)

    monkeypatch.setenv("RAG_DB", db_path)
    monkeypatch.setenv("ARTIFACTS_DIR", artifacts_dir)
    monkeypatch.setenv("WEB_ROOT", web_root)
    monkeypatch.setenv("SEO_LLM_ENABLED", "1")
    monkeypatch.setenv("OPENAI_BASE_URL", "http://127.0.0.1:0")  # force failure
    monkeypatch.setenv("FALLBACK_BASE_URL", "http://127.0.0.1:0")  # force failure too
    monkeypatch.setenv("SEO_LLM_TIMEOUT", "0.5")  # fast timeout

    # Clear cache to pick up new env vars
    from assistant_api.settings import get_settings
    get_settings.cache_clear()

    # Create test database with low-CTR data
    ensure_tables(db_path)
    now = datetime.now(timezone.utc).isoformat()
    rows = [
        CTRRow(
            url="/projects/datapipe-ai",
            impressions=1000,
            clicks=1,
            ctr=0.001,
            last_seen=now,
            source="test"
        ),
        CTRRow(
            url="/projects/clarity",
            impressions=800,
            clicks=5,
            ctr=0.006,
            last_seen=now,
            source="test"
        ),
    ]
    upsert_ctr_rows(db_path, rows)

    # Run tune; we expect artifacts and heuristic fallback
    result = run(threshold=0.02)

    assert result["ok"] is True
    assert result["count"] >= 1
    assert "json" in result
    assert "md" in result

    # Verify JSON artifact exists and contains heuristic notes
    json_path = Path(result["json"])
    assert json_path.exists()

    with open(json_path) as f:
        data = json.load(f)

    assert data["threshold"] == 0.02
    assert data["count"] >= 1
    assert len(data["pages"]) >= 1

    # All pages should use heuristic method (LLM unreachable)
    for page in data["pages"]:
        assert page["notes"] == "heuristic", f"Expected heuristic fallback, got {page['notes']}"
        assert "url" in page
        assert "ctr" in page
        assert "new_title" in page
        assert "new_description" in page

    # Verify MD artifact exists
    md_path = Path(result["md"])
    assert md_path.exists()

    # Clean up
    get_settings.cache_clear()


def test_seo_tune_with_llm_disabled(tmp_path, monkeypatch):
    """
    Test that seo.tune uses heuristic when LLM is explicitly disabled.
    """
    db_path = str(tmp_path / "rag2.sqlite")
    artifacts_dir = str(tmp_path / "artifacts2")
    web_root = str(tmp_path)

    monkeypatch.setenv("RAG_DB", db_path)
    monkeypatch.setenv("ARTIFACTS_DIR", artifacts_dir)
    monkeypatch.setenv("WEB_ROOT", web_root)
    monkeypatch.setenv("SEO_LLM_ENABLED", "0")  # explicitly disabled

    from assistant_api.settings import get_settings
    get_settings.cache_clear()

    # Create test database
    ensure_tables(db_path)
    now = datetime.now(timezone.utc).isoformat()
    rows = [
        CTRRow(
            url="/test-page",
            impressions=500,
            clicks=3,
            ctr=0.006,
            last_seen=now,
            source="test"
        ),
    ]
    upsert_ctr_rows(db_path, rows)

    # Run tune
    result = run(threshold=0.02)

    assert result["ok"] is True
    assert result["count"] == 1

    # Verify JSON artifact
    json_path = Path(result["json"])
    assert json_path.exists()

    with open(json_path) as f:
        data = json.load(f)

    # Should use heuristic (LLM disabled)
    assert data["pages"][0]["notes"] == "heuristic"

    # Clean up
    get_settings.cache_clear()
