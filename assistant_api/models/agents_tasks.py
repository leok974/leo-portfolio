"""SQLAlchemy model for agents_tasks table."""
from sqlalchemy import JSON, Column, DateTime, Index, Integer, String, Text

try:
    from sqlalchemy.dialects.postgresql import JSONB
except ImportError:
    JSONB = JSON  # Fallback to JSON for SQLite
from assistant_api.db import Base


class AgentTask(Base):
    """
    Tracks orchestrated agent task executions for nightly runs.

    Statuses: queued | running | succeeded | failed | awaiting_approval | skipped
    Approval states: pending | approved | rejected
    """
    __tablename__ = "agents_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task = Column(String(64), nullable=False)  # e.g., "seo.validate", "code.review"
    run_id = Column(String(64), nullable=False, index=True)  # e.g., "nightly-2025-01-15"
    status = Column(String(32), nullable=False)  # queued | running | succeeded | failed | awaiting_approval | skipped
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    inputs = Column(JSON, nullable=True)  # Will use JSONB if PostgreSQL
    outputs_uri = Column(String(512), nullable=True)  # PR link, artifact URL, etc.
    log_excerpt = Column(Text, nullable=True)  # first/last N lines of task output

    # Timing
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)

    # Data
    inputs = Column(JSONB, nullable=True)  # Task-specific inputs (flags, config)
    outputs_uri = Column(String(512), nullable=True)  # Link to PR, artifact, report
    log_excerpt = Column(Text, nullable=True)  # First/last N lines of stdout/stderr

    # Approval workflow
    approval_state = Column(String(32), nullable=True)  # pending | approved | rejected | cancelled
    approver = Column(String(128), nullable=True)  # User who approved/rejected
    approval_note = Column(Text, nullable=True)  # Approval/rejection/cancellation reason
    webhook_notified_at = Column(DateTime, nullable=True)  # When Slack/Email sent

    __table_args__ = (
        Index("idx_agents_tasks_run_id", "run_id"),
        Index("idx_agents_tasks_started_at", "started_at"),
    )

    def __repr__(self):
        return f"<AgentTask(id={self.id}, task={self.task}, run_id={self.run_id}, status={self.status})>"
