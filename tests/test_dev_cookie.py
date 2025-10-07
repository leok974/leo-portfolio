"""Tests for dev overlay signed cookie endpoints."""
import json
import hmac
import hashlib
import os
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    """Create a test client with clean environment."""
    # Set HMAC secret so auth is required
    monkeypatch.setenv("SITEAGENT_HMAC_SECRET", "test-hmac-default")
    from assistant_api.main import app
    return TestClient(app)


def _sig(secret: str, body: bytes) -> str:
    """Generate HMAC signature for request body."""
    return "sha256=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def test_dev_cookie_enable_disable(monkeypatch, client):
    """Test dev overlay cookie enable/disable flow with HMAC auth."""
    # Set HMAC secret & cookie key for signing
    monkeypatch.setenv("SITEAGENT_HMAC_SECRET", "test-hmac")
    monkeypatch.setenv("SITEAGENT_DEV_COOKIE_KEY", "test-cookie-key")

    # Initially not allowed (no cookie)
    r0 = client.get("/agent/dev/status")
    assert r0.status_code == 200
    assert r0.json() == {"allowed": False}

    # Enable via authorized call (HMAC)
    body = json.dumps({"hours": 1}).encode("utf-8")
    r1 = client.post(
        "/agent/dev/enable",
        data=body,
        headers={
            "X-SiteAgent-Signature": _sig("test-hmac", body),
            "Content-Type": "application/json",
        },
    )
    assert r1.status_code == 200
    assert "sa_dev" in r1.cookies

    # Cookie present; status should be allowed now
    cookies = {"sa_dev": r1.cookies["sa_dev"]}
    r2 = client.get("/agent/dev/status", cookies=cookies)
    assert r2.status_code == 200
    assert r2.json()["allowed"] is True

    # Disable
    r3 = client.post(
        "/agent/dev/disable",
        headers={
            "X-SiteAgent-Signature": _sig("test-hmac", b""),
            "Content-Type": "application/json",
        },
    )
    assert r3.status_code == 200

    # Status should be false again (cookie deleted)
    r4 = client.get("/agent/dev/status")
    assert r4.status_code == 200
    assert r4.json()["allowed"] is False


def test_dev_enable_requires_auth(client):
    """Test that dev/enable requires authentication."""
    r = client.post(
        "/agent/dev/enable",
        json={"hours": 1},
    )
    # Should fail without auth
    assert r.status_code == 401


def test_dev_disable_requires_auth(client):
    """Test that dev/disable requires authentication."""
    r = client.post("/agent/dev/disable")
    # Should fail without auth
    assert r.status_code == 401


def test_dev_enable_without_cookie_key(monkeypatch, client):
    """Test that dev/enable fails if SITEAGENT_DEV_COOKIE_KEY not set."""
    monkeypatch.setenv("SITEAGENT_HMAC_SECRET", "test-hmac")
    monkeypatch.delenv("SITEAGENT_DEV_COOKIE_KEY", raising=False)

    body = json.dumps({"hours": 1}).encode("utf-8")
    r = client.post(
        "/agent/dev/enable",
        data=body,
        headers={
            "X-SiteAgent-Signature": _sig("test-hmac", body),
            "Content-Type": "application/json",
        },
    )
    assert r.status_code == 500
    assert "SITEAGENT_DEV_COOKIE_KEY not set" in r.text


def test_dev_status_without_cookie_key(monkeypatch, client):
    """Test that dev/status returns false if no cookie key set."""
    monkeypatch.delenv("SITEAGENT_DEV_COOKIE_KEY", raising=False)

    r = client.get("/agent/dev/status")
    assert r.status_code == 200
    assert r.json() == {"allowed": False}
