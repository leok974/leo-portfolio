#!/usr/bin/env python3
"""Quick test script for admin authentication endpoints."""
import requests
import sys

BASE_URL = "http://127.0.0.1:8001"
ADMIN_EMAIL = "leoklemet.pa@gmail.com"

def test_auth():
    print("=" * 60)
    print("Testing Admin Authentication Endpoints")
    print("=" * 60)

    # Test 1: Login
    print("\n1. Testing login...")
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/admin/login",
            params={"email": ADMIN_EMAIL},
            timeout=5
        )
        print(f"   Status: {response.status_code}")
        print(f"   Body: {response.json()}")

        if response.status_code != 200:
            print("   ❌ Login failed!")
            return False

        cookies = response.cookies
        admin_cookie = cookies.get("admin_auth")
        if not admin_cookie:
            print("   ❌ No admin_auth cookie in response!")
            return False

        print(f"   Cookie: {admin_cookie[:50]}...")
        print("   ✅ Login successful")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

    # Test 2: Verify /me endpoint without cookie
    print("\n2. Testing /me endpoint (no auth)...")
    try:
        response = requests.get(f"{BASE_URL}/api/auth/me", timeout=5)
        data = response.json()
        print(f"   Response: {data}")
        if data.get("is_admin"):
            print("   ❌ Should not be admin without cookie!")
            return False
        print("   ✅ Correctly returns non-admin")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

    # Test 3: Verify /me endpoint with cookie
    print("\n3. Testing /me endpoint (with auth)...")
    try:
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"admin_auth": admin_cookie},
            timeout=5
        )
        data = response.json()
        print(f"   Response: {data}")

        if not data.get("is_admin"):
            print("   ❌ Should be admin with valid cookie!")
            return False
        if data.get("user", {}).get("email") != ADMIN_EMAIL:
            print("   ❌ Email mismatch!")
            return False
        if "admin" not in data.get("roles", []):
            print("   ❌ Admin role missing!")
            return False

        print("   ✅ Admin authentication verified")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

    # Test 4: Test logout
    print("\n4. Testing logout...")
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/admin/logout",
            cookies={"admin_auth": admin_cookie},
            timeout=5
        )
        print(f"   Status: {response.status_code}")
        print(f"   Body: {response.json()}")
        print("   ✅ Logout successful")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

    print("\n" + "=" * 60)
    print("✅ All authentication tests passed!")
    print("=" * 60)
    return True

if __name__ == "__main__":
    try:
        success = test_auth()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted")
        sys.exit(1)
