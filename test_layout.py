#!/usr/bin/env python3
"""Test admin-protected layout endpoints."""
import requests
import sys

BASE_URL = "http://127.0.0.1:8001"
ADMIN_EMAIL = "leoklemet.pa@gmail.com"

def test_layout_endpoints():
    print("=" * 60)
    print("Testing Admin-Protected Layout Endpoints")
    print("=" * 60)

    # Get admin cookie
    print("\n1. Getting admin cookie...")
    response = requests.post(
        f"{BASE_URL}/api/auth/admin/login",
        params={"email": ADMIN_EMAIL},
        timeout=5
    )
    admin_cookie = response.cookies.get("admin_auth")
    print(f"   Cookie: {admin_cookie[:50] if admin_cookie else 'NONE'}...")

    # Test reset endpoint WITH cookie
    print("\n2. Testing /api/layout/reset (with admin cookie)...")
    response = requests.post(
        f"{BASE_URL}/api/layout/reset",
        cookies={"admin_auth": admin_cookie},
        timeout=5
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        print(f"   Response: {response.json()}")
        print("   ✅ Reset endpoint working")
    else:
        print(f"   ❌ Expected 200, got {response.status_code}")
        print(f"   Response: {response.text}")
        return False

    # Test autotune endpoint WITH cookie
    print("\n3. Testing /api/layout/autotune (with admin cookie)...")
    response = requests.post(
        f"{BASE_URL}/api/layout/autotune",
        cookies={"admin_auth": admin_cookie},
        timeout=5
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        print(f"   Response: {response.json()}")
        print("   ✅ Autotune endpoint working")
    else:
        print(f"   ❌ Expected 200, got {response.status_code}")
        print(f"   Response: {response.text}")
        return False

    # Test reset endpoint WITHOUT cookie
    print("\n4. Testing /api/layout/reset (without cookie)...")
    response = requests.post(
        f"{BASE_URL}/api/layout/reset",
        timeout=5
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 401:
        print("   ✅ Correctly blocked (401)")
    else:
        print(f"   ❌ Expected 401, got {response.status_code}")
        return False

    print("\n" + "=" * 60)
    print("✅ All layout endpoint tests passed!")
    print("=" * 60)
    return True

if __name__ == "__main__":
    try:
        success = test_layout_endpoints()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
