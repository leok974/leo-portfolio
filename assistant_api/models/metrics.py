from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, StringConstraints

EventType = Literal["view", "click", "dwell"]


class MetricEvent(BaseModel):
    session_id: str = Field(min_length=8)
    visitor_id: str = Field(min_length=8)  # already hashed client-side
    section: str  # e.g., "projects"
    event_type: EventType
    ts: datetime
    viewport_pct: float | None = None  # 0..1
    dwell_ms: int | None = None  # for "dwell"
    # Optional A/B and geo metadata (filled client- or server-side)
    variant: str | None = None  # e.g., "A" | "B" | "alg-v2"
    anon_ip_prefix: str | None = None
    country: str | None = None


class MetricIngestRequest(BaseModel):
    events: list[MetricEvent]


# Phase 50.8 - Behavior Analytics models
EventName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
VisitorID = Annotated[str, StringConstraints(strip_whitespace=True, min_length=6, max_length=64)]


class BehaviorEvent(BaseModel):
    visitor_id: VisitorID = Field(..., description="Anonymous sticky ID (hash)")
    event: EventName = Field(..., description="Event name, e.g., 'page_view', 'link_click'")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)
    user_agent: str | None = None


class EventIngestResult(BaseModel):
    ok: bool
    stored: int
    file: str | None = None


class BehaviorAggBucket(BaseModel):
    event: str
    count: int


class BehaviorSnapshot(BaseModel):
    total: int
    by_event: list[BehaviorAggBucket]
    last_events: list[BehaviorEvent]
    file_size_bytes: int | None = None

