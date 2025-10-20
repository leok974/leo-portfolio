"""
Tests for admin_projects router with CF Access guard and dev bypass.
"""
import pytest
import os
from fastapi.testclient import TestClient

# Set dev bypass key BEFORE importing app
os.environ["DEV_HMAC_KEY"] = "test-dev-key-123"
os.environ["CF_ACCESS_AUD"] = "test-aud"
os.environ["CF_ACCESS_TEAM_DOMAIN"] = "test-team.cloudflareaccess.com"

from assistant_api.main import app

client = TestClient(app)


def test_guard_blocks_without_auth():
    """Test that endpoints are protected without auth"""
    r = client.post("/api/admin/projects/hide", json={"slug": "test-project"})
    assert r.status_code == 401
    assert "Missing CF Access token" in r.text


def test_hide_with_dev_bypass():
    """Test hiding a project with dev bypass key"""
    headers = {"x-dev-key": "test-dev-key-123"}
    r = client.post(
        "/api/admin/projects/hide",
        json={"slug": "test-project"},
        headers=headers
    )
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert "test-project" in data["hidden"]


def test_unhide_with_dev_bypass():
    """Test unhiding a project with dev bypass key"""
    headers = {"x-dev-key": "test-dev-key-123"}
    
    # First hide it
    client.post(
        "/api/admin/projects/hide",
        json={"slug": "test-unhide"},
        headers=headers
    )
    
    # Then unhide it
    r = client.post(
        "/api/admin/projects/unhide",
        json={"slug": "test-unhide"},
        headers=headers
    )
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert "test-unhide" not in data["hidden"]


def test_get_hidden_with_dev_bypass():
    """Test getting hidden projects list with dev bypass key"""
    headers = {"x-dev-key": "test-dev-key-123"}
    
    r = client.get("/api/admin/projects/hidden", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "hidden" in data
    assert "count" in data
    assert isinstance(data["hidden"], list)


def test_wrong_dev_key_rejected():
    """Test that wrong dev key is rejected"""
    headers = {"x-dev-key": "wrong-key"}
    r = client.post(
        "/api/admin/projects/hide",
        json={"slug": "test"},
        headers=headers
    )
    assert r.status_code == 401


def test_hide_already_hidden():
    """Test hiding a project that's already hidden"""
    headers = {"x-dev-key": "test-dev-key-123"}
    
    # Hide twice
    client.post(
        "/api/admin/projects/hide",
        json={"slug": "duplicate-hide"},
        headers=headers
    )
    r = client.post(
        "/api/admin/projects/hide",
        json={"slug": "duplicate-hide"},
        headers=headers
    )
    
    assert r.status_code == 200
    data = r.json()
    assert "already hidden" in data["message"]


def test_unhide_not_hidden():
    """Test unhiding a project that wasn't hidden"""
    headers = {"x-dev-key": "test-dev-key-123"}
    
    r = client.post(
        "/api/admin/projects/unhide",
        json={"slug": "never-hidden"},
        headers=headers
    )
    
    assert r.status_code == 200
    data = r.json()
    assert "was not hidden" in data["message"]


def test_case_insensitive_hide_unhide():
    """Test that hide/unhide is case-insensitive"""
    headers = {"x-dev-key": "test-dev-key-123"}
    
    # Hide with lowercase
    client.post(
        "/api/admin/projects/hide",
        json={"slug": "test-case"},
        headers=headers
    )
    
    # Unhide with different case
    r = client.post(
        "/api/admin/projects/unhide",
        json={"slug": "TEST-CASE"},
        headers=headers
    )
    
    assert r.status_code == 200
    data = r.json()
    assert all(s.lower() != "test-case" for s in data["hidden"])
