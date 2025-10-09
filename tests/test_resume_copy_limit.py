"""Tests for resume copy.txt compact text generation."""
from fastapi.testclient import TestClient
from assistant_api.main import app
from pathlib import Path
import json

client = TestClient(app)


def test_copy_limited(monkeypatch, tmp_path):
    """Test that copy.txt respects character limit."""
    from assistant_api.routers import resume_public as rp
    monkeypatch.setattr(rp, "ROOT", tmp_path)
    pj = tmp_path / "projects.json"
    # Create a project with very long summary to test truncation
    pj.write_text(
        json.dumps([{"title": "SiteAgent", "summary": "x" * 5000, "tags": ["ai"]}]),
        encoding="utf-8"
    )
    monkeypatch.setattr(rp, "PROJECTS_JSON", pj)
    monkeypatch.setattr(rp, "SITE_INDEX", tmp_path / "index.html")

    r = client.get("/resume/copy.txt?limit=300")
    assert r.status_code == 200
    body = r.text
    assert len(body) <= 301  # accounts for trailing ellipsis


def test_copy_default_limit(monkeypatch, tmp_path):
    """Test that copy.txt uses default 2600 char limit."""
    from assistant_api.routers import resume_public as rp
    monkeypatch.setattr(rp, "ROOT", tmp_path)
    pj = tmp_path / "projects.json"
    pj.write_text(
        json.dumps([{"title": "Test Project", "summary": "Short summary", "tags": ["python"]}]),
        encoding="utf-8"
    )
    monkeypatch.setattr(rp, "PROJECTS_JSON", pj)
    monkeypatch.setattr(rp, "SITE_INDEX", tmp_path / "index.html")

    r = client.get("/resume/copy.txt")
    assert r.status_code == 200
    assert r.headers["content-type"] == "text/plain; charset=utf-8"
    # Should not have ellipsis for short content
    assert len(r.text) <= 2600
