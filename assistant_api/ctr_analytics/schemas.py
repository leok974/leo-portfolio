# assistant_api/analytics/schemas.py
from __future__ import annotations

from typing import List, Literal

from pydantic import BaseModel, Field


class CTRRowIn(BaseModel):
    url: str
    impressions: int = Field(ge=0)
    clicks: int = Field(ge=0)

class IngestPayload(BaseModel):
    source: Literal["search_console", "ga4", "manual"] = "search_console"
    rows: list[CTRRowIn]

class IngestResult(BaseModel):
    inserted_or_updated: int
    rows: int
    source: str
