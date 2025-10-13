"""SQLAlchemy models for agent task tracking."""
from sqlalchemy import JSON, Boolean, Column, DateTime, String, Text, func
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class AgentTask(Base):
    """Agent task with approval workflow."""
    __tablename__ = "agents_tasks"

    id = Column(String(36), primary_key=True)  # uuid4 string
    agent = Column(String(64), nullable=False)
    task = Column(String(64), nullable=False)
    status = Column(String(32), nullable=False, default="queued")
    # Status values: queued|running|awaiting_approval|succeeded|failed|rejected|canceled

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    inputs = Column(JSON, nullable=True)
    outputs_uri = Column(String(512), nullable=True)
    logs = Column(Text, nullable=True)

    needs_approval = Column(Boolean, default=True)
    approved_by = Column(String(128), nullable=True)
    approval_note = Column(Text, nullable=True)
