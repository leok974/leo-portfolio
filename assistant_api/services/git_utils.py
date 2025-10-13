"""Git utilities for agent tasks."""
from __future__ import annotations

import pathlib
import subprocess


def make_diff(path: str) -> str:
    """
    Generate git diff for a file path.

    Args:
        path: Path to file (relative or absolute)

    Returns:
        Git diff output as string, or empty string if error
    """
    file_path = pathlib.Path(path)
    if not file_path.exists():
        return ""

    try:
        # Produce a working-tree diff
        result = subprocess.run(
            ["git", "diff", "--", str(file_path)],
            capture_output=True,
            text=True,
            check=False,
            cwd=file_path.parent if file_path.is_absolute() else None
        )
        return result.stdout
    except Exception:
        return ""
