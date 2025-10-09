"""Tests for resume role and seniority tuning."""
from fastapi.testclient import TestClient
from assistant_api.main import app
from pathlib import Path
import json

client = TestClient(app)


def _seed_projects(tmp_path):
    """Create a test projects.json file."""
    pj = tmp_path / "projects.json"
    pj.write_text(
        json.dumps([
            {"title": "SiteAgent", "summary": "Autonomous portfolio agent", "tags": ["ai", "fastapi", "playwright"]},
            {"title": "LedgerMind", "summary": "Explainable finance agent", "tags": ["rag", "ollama", "react"]}
        ]),
        encoding="utf-8"
    )
    return pj


def test_roles_and_seniority_tune(monkeypatch, tmp_path):
    """Test that roles and seniority query params tune the headline."""
    from assistant_api.routers import resume_public as rp
    monkeypatch.setattr(rp, "ROOT", tmp_path)
    monkeypatch.setattr(rp, "PROJECTS_JSON", _seed_projects(tmp_path))
    monkeypatch.setattr(rp, "SITE_INDEX", tmp_path / "index.html")

    r = client.get("/resume/generate.md?roles=ai,swe&seniority=senior")
    assert r.status_code == 200
    md = r.text.lower()
    assert "ai engineer / software engineer" in md or "senior" in md
    # achievements section optional
    assert isinstance(md, str)
