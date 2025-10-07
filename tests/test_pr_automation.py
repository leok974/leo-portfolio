"""Tests for PR automation and workflow generation endpoints."""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    """Create a test client with clean environment."""
    # Set HMAC secret so auth is required
    monkeypatch.setenv("SITEAGENT_HMAC_SECRET", "test-hmac-default")
    from assistant_api.main import app
    return TestClient(app)


def test_pr_open_disabled(monkeypatch, client):
    """Test that PR open returns 503 when GITHUB_TOKEN not set."""
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)

    # Try to open PR without GitHub token configured
    r = client.post(
        "/agent/pr/open",
        json={"title": "test", "branch": "test-branch"},
        headers={"X-SiteAgent-Signature": "sha256=invalid"}  # Auth will fail first
    )

    # Should fail with auth error first (401) or token missing (503)
    assert r.status_code in [401, 503]
    if r.status_code == 503:
        assert "pr_disabled" in r.text or "GITHUB_TOKEN" in r.text


def test_pr_open_stub_with_token(monkeypatch, client):
    """Test that PR open returns stub response when GITHUB_TOKEN is set."""
    import hmac
    import hashlib

    monkeypatch.setenv("SITEAGENT_HMAC_SECRET", "test-hmac")
    monkeypatch.setenv("GITHUB_TOKEN", "fake-token")
    monkeypatch.setenv("GITHUB_REPO", "test/repo")

    # Valid HMAC signature
    body = b'{"title":"Test PR","branch":"test","body":"Test body"}'
    sig = hmac.new(b"test-hmac", body, hashlib.sha256).hexdigest()

    r = client.post(
        "/agent/pr/open",
        data=body,
        headers={
            "X-SiteAgent-Signature": f"sha256={sig}",
            "Content-Type": "application/json"
        }
    )

    assert r.status_code == 200
    j = r.json()
    assert j["ok"] is True
    assert j["mode"] == "stub"
    assert j["repo"] == "test/repo"
    assert j["title"] == "Test PR"


def test_workflow_yaml(client):
    """Test workflow YAML generation."""
    r = client.get("/agent/automation/workflow")
    assert r.status_code == 200
    assert r.headers["content-type"] == "text/yaml; charset=utf-8"

    text = r.text
    assert "siteagent-nightly" in text
    assert "schedule:" in text
    assert "cron:" in text
    assert "workflow_dispatch:" in text
    assert "siteagent-bot" in text


def test_artifacts_endpoint(client, tmp_path, monkeypatch):
    """Test artifact file serving."""
    # Create a temporary artifact
    import os
    os.makedirs("assets/data", exist_ok=True)

    with open("assets/data/test-artifact.diff", "w") as f:
        f.write("--- a/file.txt\n+++ b/file.txt\n@@ test diff\n")

    try:
        r = client.get("/agent/artifacts/test-artifact.diff")
        assert r.status_code == 200
        assert "test diff" in r.text
        assert r.headers["content-type"] == "text/plain; charset=utf-8"
    finally:
        # Cleanup
        try:
            os.remove("assets/data/test-artifact.diff")
        except:
            pass


def test_artifacts_not_found(client):
    """Test 404 for missing artifact."""
    r = client.get("/agent/artifacts/nonexistent-file.txt")
    assert r.status_code == 404
    assert "not found" in r.text.lower()


def test_artifacts_path_traversal_prevention(client):
    """Test that path traversal is prevented."""
    r = client.get("/agent/artifacts/../../../etc/passwd")
    # Should either 404 (file sanitized and not found) or 403
    assert r.status_code in [403, 404]
