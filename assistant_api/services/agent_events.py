"""
Agent Events Logging

Logs significant agent actions (scheduler runs, manual optimizations, autotuning)
for audit trail and "Last Actions" feed.
"""

import json
import pathlib
import time
from typing import Any, Dict

EVENTS = pathlib.Path("data/agent_events.jsonl")
EVENTS.parent.mkdir(parents=True, exist_ok=True)


def log_event(kind: str, meta: dict[str, Any]):
    """
    Log an agent event to JSONL file.

    Args:
        kind: Event type (e.g., "scheduler.optimize", "manual.optimize", "autotune.optimize")
        meta: Additional event metadata
    """
    # Ensure file exists
    if not EVENTS.exists():
        EVENTS.write_text("", encoding="utf-8")

    with EVENTS.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"ts": int(time.time()), "kind": kind, "meta": meta}) + "\n")


def recent_events(limit: int = 50) -> list[dict[str, Any]]:
    """
    Get recent events (most recent first).

    Args:
        limit: Maximum number of events to return

    Returns:
        List of event dicts
    """
    if not EVENTS.exists():
        return []

    events = []
    with EVENTS.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except Exception:
                continue

    # Return most recent first
    return sorted(events, key=lambda e: e["ts"], reverse=True)[:limit]
