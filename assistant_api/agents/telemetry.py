"""Agent task telemetry - push events to /metrics for dashboards."""

import asyncio
from datetime import datetime
from typing import Any, Dict

import httpx


# Lightweight telemetry - fire and forget, never blocks task execution
async def push_event(
    event_type: str,
    agent: str,
    task: str,
    task_id: str,
    status: str,
    metadata: dict[str, Any] = None,
):
    """Push agent task event to metrics endpoint (non-blocking)."""
    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            await client.post(
                "http://localhost:8001/agent/metrics/ingest",
                json={
                    "events": [
                        {
                            "timestamp": datetime.utcnow().isoformat(),
                            "event_type": event_type,
                            "category": "agent_task",
                            "agent": agent,
                            "task": task,
                            "task_id": task_id,
                            "status": status,
                            "metadata": metadata or {},
                        }
                    ]
                },
                headers={"Origin": "http://localhost:5173"},
            )
    except Exception:
        # Silently ignore telemetry failures - never impact task execution
        pass


def track_status_change(
    agent: str, task: str, task_id: str, status: str, metadata: dict[str, Any] = None
):
    """Fire-and-forget status change event."""
    asyncio.create_task(
        push_event("status_change", agent, task, task_id, status, metadata)
    )
