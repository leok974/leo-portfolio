"""Tests for resume PDF generation endpoint."""
from fastapi.testclient import TestClient
from assistant_api.main import app
from pathlib import Path
import json

client = TestClient(app)


def test_pdf_works_or_graceful(monkeypatch, tmp_path):
    """Test PDF generation works with reportlab or fails gracefully."""
    from assistant_api.routers import resume_public as rp
    monkeypatch.setattr(rp, "ROOT", tmp_path)
    pj = tmp_path / "projects.json"
    pj.write_text(
        json.dumps([{"title": "SiteAgent", "summary": "Autonomous agent", "tags": ["ai"]}]),
        encoding="utf-8"
    )
    monkeypatch.setattr(rp, "PROJECTS_JSON", pj)
    monkeypatch.setattr(rp, "SITE_INDEX", tmp_path / "index.html")

    # Prefer real if reportlab installed; otherwise monkeypatch renderer
    try:
        import reportlab  # noqa: F401
        has_reportlab = True
    except Exception:
        has_reportlab = False
        
        def fake_render(md):
            return b"%PDF-1.4\n%fake\n"
        
        monkeypatch.setattr(rp, "_render_pdf", fake_render)

    r = client.get("/resume/generate.pdf")
    assert r.status_code in (200, 503)
    if r.status_code == 200:
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"


def test_pdf_with_roles(monkeypatch, tmp_path):
    """Test PDF generation with role query parameters."""
    from assistant_api.routers import resume_public as rp
    monkeypatch.setattr(rp, "ROOT", tmp_path)
    pj = tmp_path / "projects.json"
    pj.write_text(
        json.dumps([{"title": "Test Project", "summary": "A test", "tags": ["python", "ai"]}]),
        encoding="utf-8"
    )
    monkeypatch.setattr(rp, "PROJECTS_JSON", pj)
    monkeypatch.setattr(rp, "SITE_INDEX", tmp_path / "index.html")

    try:
        import reportlab  # noqa: F401
    except Exception:
        def fake_render(md):
            return b"%PDF-1.4\n%fake\n"
        monkeypatch.setattr(rp, "_render_pdf", fake_render)

    r = client.get("/resume/generate.pdf?roles=ai&seniority=mid")
    assert r.status_code in (200, 503)
    if r.status_code == 200:
        assert "Content-Disposition" in r.headers
        assert "Leo_Klemet_LinkedIn.pdf" in r.headers["Content-Disposition"]
