"""Admin Projects ORM Model"""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, func

from assistant_api.db import Base


class AdminProject(Base):
    """Projects that can be hidden/shown via admin API."""
    
    __tablename__ = "admin_projects"
    
    id = Column(Integer, primary_key=True)
    slug = Column(String(255), nullable=False, unique=True)
    hidden = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<AdminProject(slug={self.slug!r}, hidden={self.hidden})>"
