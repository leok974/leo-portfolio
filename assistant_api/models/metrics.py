from __future__ import annotations
from pydantic import BaseModel, Field, constr, StringConstraints
from typing import Optional, List, Literal, Dict, Any, Annotated
from datetime import datetime

EventType = Literal["view", "click", "dwell"]


class MetricEvent(BaseModel):
    session_id: str = Field(min_length=8)
    visitor_id: str = Field(min_length=8)  # already hashed client-side
    section: str  # e.g., "projects"
    event_type: EventType
    ts: datetime
    viewport_pct: Optional[float] = None  # 0..1
    dwell_ms: Optional[int] = None  # for "dwell"
    # Optional A/B and geo metadata (filled client- or server-side)
    variant: Optional[str] = None  # e.g., "A" | "B" | "alg-v2"
    anon_ip_prefix: Optional[str] = None
    country: Optional[str] = None


class MetricIngestRequest(BaseModel):
    events: List[MetricEvent]


# Phase 50.8 - Behavior Analytics models
EventName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
VisitorID = Annotated[str, StringConstraints(strip_whitespace=True, min_length=6, max_length=64)]


class BehaviorEvent(BaseModel):
    visitor_id: VisitorID = Field(..., description="Anonymous sticky ID (hash)")
    event: EventName = Field(..., description="Event name, e.g., 'page_view', 'link_click'")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    user_agent: Optional[str] = None


class EventIngestResult(BaseModel):
    ok: bool
    stored: int
    file: Optional[str] = None


class BehaviorAggBucket(BaseModel):
    event: str
    count: int


class BehaviorSnapshot(BaseModel):
    total: int
    by_event: List[BehaviorAggBucket]
    last_events: List[BehaviorEvent]
    file_size_bytes: Optional[int] = None

