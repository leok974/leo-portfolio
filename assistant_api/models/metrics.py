from pydantic import BaseModel, Field
from typing import Optional, List, Literal
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
