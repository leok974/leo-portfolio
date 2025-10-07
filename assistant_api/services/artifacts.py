"""Artifact writing utilities for agent tasks."""
from __future__ import annotations
import pathlib
import json
import time

ART_DIR = pathlib.Path("agent_artifacts")
ART_DIR.mkdir(exist_ok=True, parents=True)


def write_artifact(name: str, data) -> str:
    """
    Write agent task artifact to timestamped file.

    Args:
        name: Base filename (e.g., "layout-optimize.json")
        data: Data to write (will be JSON-serialized)

    Returns:
        String path to written file
    """
    timestamp = int(time.time())
    filename = f"{timestamp}_{name}"
    file_path = ART_DIR / filename

    content = json.dumps(data, indent=2, ensure_ascii=False)
    file_path.write_text(content, encoding="utf-8")

    return str(file_path)
