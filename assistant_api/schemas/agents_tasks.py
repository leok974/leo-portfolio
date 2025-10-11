"""Pydantic schemas for agents_tasks API."""
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


class AgentTaskCreate(BaseModel):
    """Schema for creating a new agent task."""
    task: str = Field(..., max_length=64, description="Task name (e.g., 'seo.validate')")
    run_id: str = Field(..., max_length=64, description="Run identifier (e.g., 'nightly-2025-01-15')")
    status: str = Field(..., max_length=32, description="Initial status (typically 'queued' or 'running')")
    started_at: Optional[datetime] = Field(None, description="Task start timestamp")
    inputs: Optional[dict[str, Any]] = Field(None, description="Task-specific inputs (flags, config)")


class AgentTaskUpdate(BaseModel):
    """Schema for updating an existing agent task."""
    status: Optional[str] = Field(None, max_length=32, description="Updated status")
    finished_at: Optional[datetime] = Field(None, description="Task completion timestamp")
    duration_ms: Optional[int] = Field(None, description="Execution duration in milliseconds")
    outputs_uri: Optional[str] = Field(None, max_length=512, description="Link to PR, artifact, or report")
    log_excerpt: Optional[str] = Field(None, description="First/last N lines of stdout/stderr")
    approval_state: Optional[str] = Field(None, max_length=32, description="pending | approved | rejected | cancelled")
    approver: Optional[str] = Field(None, max_length=128, description="User who approved/rejected")
    approval_note: Optional[str] = Field(None, description="Approval/rejection/cancellation reason")
    webhook_notified_at: Optional[datetime] = Field(None, description="Webhook notification timestamp")


class AgentTaskOut(BaseModel):
    """Schema for agent task output (read operations)."""
    id: int
    task: str
    run_id: str
    status: str
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    inputs: Optional[dict[str, Any]] = None
    outputs_uri: Optional[str] = None
    log_excerpt: Optional[str] = None
    approval_state: Optional[str] = None
    approver: Optional[str] = None
    approval_note: Optional[str] = None
    webhook_notified_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # Enable ORM mode for SQLAlchemy models


class AgentTaskListOut(BaseModel):
    """Schema for paginated agent task list output."""
    items: list[AgentTaskOut]
    next_cursor: Optional[str] = None
