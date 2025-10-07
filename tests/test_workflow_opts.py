"""Tests for workflow generator options."""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    """Create a test client with clean environment."""
    monkeypatch.setenv("SITEAGENT_HMAC_SECRET", "test-hmac-default")
    from assistant_api.main import app
    return TestClient(app)


def test_workflow_defaults(client):
    """Test workflow generation with default settings."""
    r = client.get("/agent/automation/workflow")
    assert r.status_code == 200
    s = r.text
    assert "links.validate" in s
    assert "media.optimize" in s
    assert "sitemap.media.update" in s
    assert "siteagent-nightly" in s


def test_workflow_include_filter(client):
    """Test workflow generation with include filter."""
    r = client.get("/agent/automation/workflow?include=links.validate,sitemap.media.update")
    assert r.status_code == 200
    s = r.text
    assert "links.validate" in s
    assert "sitemap.media.update" in s
    # media.optimize should be excluded (not in include list)


def test_workflow_exclude_filter(client):
    """Test workflow generation with exclude filter."""
    r = client.get("/agent/automation/workflow?exclude=media.optimize")
    assert r.status_code == 200
    s = r.text
    assert "links.validate" in s
    assert "sitemap.media.update" in s
    assert "media.optimize" not in s


def test_workflow_include_and_exclude(client):
    """Test workflow generation with both include and exclude filters."""
    r = client.get("/agent/automation/workflow?include=links.validate,sitemap.media.update&exclude=sitemap.media.update")
    assert r.status_code == 200
    s = r.text
    assert "links.validate" in s
    assert "sitemap.media.update" not in s  # excluded takes precedence


def test_workflow_dry_run_enabled(client):
    """Test workflow generation with dry-run mode."""
    r = client.get("/agent/automation/workflow?dry_run=true")
    assert r.status_code == 200
    s = r.text
    assert "DRY-RUN" in s or "dry-run" in s
    assert "--dry-run" in s or "--safe --dry-run" in s


def test_workflow_all_options(client):
    """Test workflow generation with all options combined."""
    r = client.get("/agent/automation/workflow?include=links.validate,media.optimize&exclude=media.optimize&dry_run=true")
    assert r.status_code == 200
    s = r.text
    assert "links.validate" in s
    assert "media.optimize" not in s
    assert "DRY-RUN" in s or "dry-run" in s


def test_workflow_yaml_format(client):
    """Test that workflow is valid YAML format."""
    r = client.get("/agent/automation/workflow")
    assert r.status_code == 200
    assert r.headers["content-type"] == "text/yaml; charset=utf-8"
    s = r.text
    # Basic YAML structure checks
    assert "name:" in s
    assert "on:" in s
    assert "jobs:" in s
    assert "steps:" in s
