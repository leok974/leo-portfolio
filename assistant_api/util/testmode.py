"""Test mode detection utility.

Provides a centralized way to detect if the application is running in test mode.
Used to relax guards and use in-memory stores during testing without weakening
production behavior.
"""

import os


def is_test_mode() -> bool:
    """Check if running in test mode.

    Returns True if any of these conditions are met:
    - TEST_MODE=1 environment variable
    - VITE_E2E=1 environment variable (E2E tests)
    - PYTEST_CURRENT_TEST is set (pytest auto-sets this)

    Returns:
        bool: True if in test mode, False otherwise
    """
    return (
        os.getenv("TEST_MODE") == "1"
        or os.getenv("VITE_E2E") == "1"
        or os.getenv("PYTEST_CURRENT_TEST") is not None
    )
