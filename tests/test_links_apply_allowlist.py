"""Tests for link-apply file allowlist and per-file commit."""
import pytest
from fastapi.testclient import TestClient
import json
import os


@pytest.fixture()
def client(monkeypatch):
    """Create a test client with clean environment."""
    monkeypatch.setenv("SITEAGENT_HMAC_SECRET", "test-hmac-default")
    from assistant_api.main import app
    return TestClient(app)


def test_files_manifest_endpoint(client, monkeypatch, tmp_path):
    """Test that files manifest endpoint returns list from dry-run."""
    # Create artifacts directory and manifest
    artifacts_dir = tmp_path / "assets" / "data"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    manifest_file = artifacts_dir / "link-apply.files.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump({"files": ["a.md", "b.md", "c.md"]}, f)

    # Monkeypatch the ARTIFACTS_DIR
    monkeypatch.setattr(
        "assistant_api.routers.agent_public.ARTIFACTS_DIR",
        artifacts_dir
    )
    monkeypatch.setattr(
        "assistant_api.routers.agent_public.LINK_APPLY_FILES",
        manifest_file
    )

    # Reload app to pick up new paths
    from assistant_api.main import app
    client_new = TestClient(app)

    r = client_new.get("/agent/artifacts/link-apply.files")
    assert r.status_code == 200
    files = r.json()["files"]
    assert "a.md" in files
    assert "b.md" in files
    assert "c.md" in files
    assert len(files) == 3


def test_files_manifest_not_found(client):
    """Test that endpoint handles missing manifest gracefully."""
    r = client.get("/agent/artifacts/link-apply.files")
    assert r.status_code == 200
    j = r.json()
    assert j["files"] == []
    assert "note" in j or "error" in j
