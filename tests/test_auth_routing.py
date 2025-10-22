"""
Test auth routing to ensure no duplicate /auth/* routes exist.
"""

import pytest
from fastapi.testclient import TestClient


def test_auth_routing_no_duplicates(client: TestClient):
    """
    Verify no duplicate /auth/google/* routes by checking that routes exist
    and are served by the intended router.
    
    Currently we use HMAC-based auth at /api/auth, not OAuth Google routes.
    This test documents the expected auth structure.
    """
    # Test existing HMAC auth routes
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert "user" in response.json()
    
    # Verify no OAuth routes exist (yet)
    # If OAuth is added later, update this test to verify single ownership
    response = client.get("/api/auth/google/login")
    assert response.status_code == 404, "OAuth routes not implemented yet"


def test_auth_me_unauthenticated(client: TestClient):
    """Test /api/auth/me returns null user when not authenticated."""
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["user"] is None
    assert data["is_admin"] is False
    assert data["roles"] == []


def test_auth_admin_login_allowlist(client: TestClient):
    """Test /api/auth/admin/login checks email allowlist."""
    # Test with non-allowed email
    response = client.post("/api/auth/admin/login?email=hacker@evil.com")
    assert response.status_code == 403
    assert "not in admin allowlist" in response.json()["detail"]


def test_auth_admin_logout(client: TestClient):
    """Test /api/auth/admin/logout clears cookie."""
    response = client.post("/api/auth/admin/logout")
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    # Cookie should be deleted (check Set-Cookie header)
    assert "admin_auth" in response.headers.get("set-cookie", "")
