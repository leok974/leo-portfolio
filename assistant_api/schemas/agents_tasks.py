"""Pydantic schemas for agents_tasks API."""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class AgentTaskCreate(BaseModel):
    """Schema for creating a new agent task."""
    task: str = Field(..., max_length=64, description="Task name (e.g., 'seo.validate')")
    run_id: str = Field(..., max_length=64, description="Run identifier (e.g., 'nightly-2025-01-15')")
    status: str = Field(..., max_length=32, description="Initial status (typically 'queued' or 'running')")
    started_at: datetime | None = Field(None, description="Task start timestamp")
    inputs: dict[str, Any] | None = Field(None, description="Task-specific inputs (flags, config)")


class AgentTaskUpdate(BaseModel):
    """Schema for updating an existing agent task."""
    status: str | None = Field(None, max_length=32, description="Updated status")
    finished_at: datetime | None = Field(None, description="Task completion timestamp")
    duration_ms: int | None = Field(None, description="Execution duration in milliseconds")
    outputs_uri: str | None = Field(None, max_length=512, description="Link to PR, artifact, or report")
    log_excerpt: str | None = Field(None, description="First/last N lines of stdout/stderr")
    approval_state: str | None = Field(None, max_length=32, description="pending | approved | rejected | cancelled")
    approver: str | None = Field(None, max_length=128, description="User who approved/rejected")
    approval_note: str | None = Field(None, description="Approval/rejection/cancellation reason")
    webhook_notified_at: datetime | None = Field(None, description="Webhook notification timestamp")


class AgentTaskOut(BaseModel):
    """Schema for agent task output (read operations)."""
    id: int
    task: str
    run_id: str
    status: str
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None
    inputs: dict[str, Any] | None = None
    outputs_uri: str | None = None
    log_excerpt: str | None = None
    approval_state: str | None = None
    approver: str | None = None
    approval_note: str | None = None
    webhook_notified_at: datetime | None = None

    class Config:
        from_attributes = True  # Enable ORM mode for SQLAlchemy models


class AgentTaskListOut(BaseModel):
    """Schema for paginated agent task list output."""
    items: list[AgentTaskOut]
    next_cursor: str | None = None
