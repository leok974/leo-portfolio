"""Tests for PR open with real GitHub API integration."""
import pytest
from fastapi.testclient import TestClient
import httpx
import hmac
import hashlib
import json


@pytest.fixture()
def client(monkeypatch):
    """Create a test client with clean environment."""
    monkeypatch.setenv("SITEAGENT_HMAC_SECRET", "test-hmac")
    from assistant_api.main import app
    return TestClient(app)


def _sig(secret: str, body: bytes) -> str:
    """Generate HMAC signature for request body."""
    return "sha256=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def test_pr_disabled(monkeypatch, client):
    """Test that PR open returns 503 when GITHUB_TOKEN not set."""
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    
    body = json.dumps({"title": "t", "branch": "b"}).encode("utf-8")
    r = client.post(
        "/agent/pr/open",
        data=body,
        headers={
            "X-SiteAgent-Signature": _sig("test-hmac", body),
            "Content-Type": "application/json"
        }
    )
    assert r.status_code == 503
    assert "pr_disabled" in r.text or "GITHUB_TOKEN" in r.text


def test_pr_repo_error(monkeypatch, client):
    """Test that PR open handles repo fetch error."""
    monkeypatch.setenv("GITHUB_TOKEN", "test-token")
    monkeypatch.setenv("GITHUB_REPO", "owner/repo")
    
    # Mock httpx to return error on repo GET
    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass
        
        async def __aenter__(self):
            return self
        
        async def __aexit__(self, *args):
            pass
        
        async def get(self, *args, **kwargs):
            return httpx.Response(500, json={"message": "Internal error"})
        
        async def post(self, *args, **kwargs):
            return httpx.Response(201, json={"html_url": "https://x/pr/1", "number": 1})
    
    monkeypatch.setattr("httpx.AsyncClient", MockAsyncClient)
    
    body = json.dumps({"title": "t", "branch": "b"}).encode("utf-8")
    r = client.post(
        "/agent/pr/open",
        data=body,
        headers={
            "X-SiteAgent-Signature": _sig("test-hmac", body),
            "Content-Type": "application/json"
        }
    )
    assert r.status_code == 502
    assert "github_repo_error" in r.text


def test_pr_ok(monkeypatch, client):
    """Test successful PR creation."""
    monkeypatch.setenv("GITHUB_TOKEN", "test-token")
    monkeypatch.setenv("GITHUB_REPO", "owner/repo")
    
    # Mock httpx to return success
    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass
        
        async def __aenter__(self):
            return self
        
        async def __aexit__(self, *args):
            pass
        
        async def get(self, url, **kwargs):
            return httpx.Response(200, json={"default_branch": "main"})
        
        async def post(self, url, **kwargs):
            return httpx.Response(201, json={"html_url": "https://github.com/owner/repo/pull/42", "number": 42})
    
    monkeypatch.setattr("httpx.AsyncClient", MockAsyncClient)
    
    body = json.dumps({"title": "Test PR", "branch": "test-branch"}).encode("utf-8")
    r = client.post(
        "/agent/pr/open",
        data=body,
        headers={
            "X-SiteAgent-Signature": _sig("test-hmac", body),
            "Content-Type": "application/json"
        }
    )
    assert r.status_code == 200
    j = r.json()
    assert j["ok"] is True
    assert j["url"].endswith("/42")
    assert j["number"] == 42
    assert j["status"] == "created"


def test_pr_already_exists(monkeypatch, client):
    """Test PR open when PR already exists (422 response)."""
    monkeypatch.setenv("GITHUB_TOKEN", "test-token")
    monkeypatch.setenv("GITHUB_REPO", "owner/repo")
    
    # Mock httpx to return 422 (PR exists)
    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass
        
        async def __aenter__(self):
            return self
        
        async def __aexit__(self, *args):
            pass
        
        async def get(self, url, **kwargs):
            return httpx.Response(200, json={"default_branch": "main"})
        
        async def post(self, url, **kwargs):
            return httpx.Response(422, json={"message": "Validation Failed"})
    
    monkeypatch.setattr("httpx.AsyncClient", MockAsyncClient)
    
    body = json.dumps({"title": "Test PR", "branch": "test-branch"}).encode("utf-8")
    r = client.post(
        "/agent/pr/open",
        data=body,
        headers={
            "X-SiteAgent-Signature": _sig("test-hmac", body),
            "Content-Type": "application/json"
        }
    )
    assert r.status_code == 200
    j = r.json()
    assert j["status"] == "already_exists"
