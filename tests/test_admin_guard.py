"""
CI Guard Test - Ensures all privileged endpoints have CF Access protection.

This test prevents accidentally exposing privileged operations by checking
that all routes under /api/admin/* have require_cf_access dependency.
"""
import pytest
from fastapi.routing import APIRoute
from assistant_api.main import app

# Protected prefixes that MUST have CF Access guard
PROTECTED_PREFIXES = ("/api/admin",)


def test_admin_routes_have_cf_access_guard():
    """
    Verify all /api/admin/* routes have require_cf_access dependency.

    This prevents accidentally exposing privileged operations like:
    - File uploads
    - Gallery management
    - Administrative actions

    Fails the build if any protected route is missing the guard.
    """
    unguarded = []

    for route in app.routes:
        # Only check APIRoute instances (not Mount, WebSocket, etc.)
        if not isinstance(route, APIRoute):
            continue

        # Check if route is under protected prefix
        is_protected = any(route.path.startswith(prefix) for prefix in PROTECTED_PREFIXES)
        if not is_protected:
            continue

        # Extract dependency names
        dep_names = [
            getattr(d.call, "__name__", str(d.call))
            for d in (route.dependant.dependencies or [])
        ]

        # Check for require_cf_access
        if "require_cf_access" not in dep_names:
            unguarded.append(route.path)

    # Fail with clear message if any routes are unguarded
    assert not unguarded, (
        f"The following protected routes are missing require_cf_access:\n"
        + "\n".join(f"  - {path}" for path in unguarded)
        + "\n\nAll /api/admin/* routes must have CF Access protection!"
    )


def test_admin_router_has_global_guard():
    """
    Verify the admin router itself has require_cf_access in dependencies.

    This ensures the guard is applied at the router level, not per-endpoint.
    """
    from assistant_api.routers import admin

    # Check router-level dependencies
    dep_names = []
    for d in (admin.router.dependencies or []):
        # Depends objects have a 'dependency' attribute
        if hasattr(d, 'dependency'):
            dep_names.append(getattr(d.dependency, "__name__", str(d.dependency)))
        else:
            dep_names.append(getattr(d.call, "__name__", str(d.call)))

    assert "require_cf_access" in dep_names, (
        "Admin router must have require_cf_access in router-level dependencies!\n"
        "Check: router = APIRouter(dependencies=[Depends(require_cf_access)])"
    )


def test_no_routes_under_old_prefixes():
    """
    Ensure old /api/uploads and /api/gallery prefixes are removed.

    All privileged operations should be under /api/admin/*.
    """
    old_prefixes = ("/api/uploads", "/api/gallery")
    old_routes = []

    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue

        # Check if route still uses old prefix
        is_old = any(route.path.startswith(prefix) for prefix in old_prefixes)
        if is_old:
            old_routes.append(route.path)

    assert not old_routes, (
        f"The following routes use deprecated prefixes:\n"
        + "\n".join(f"  - {path}" for path in old_routes)
        + "\n\nAll privileged operations must be under /api/admin/*!"
    )
