"""
Chapter Section Approval Model

Tracks approval status of sections within chapters.
"""

from datetime import datetime, timezone
import uuid

from sqlalchemy import Column, String, Text, UUID, DateTime, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.core.database import Base


class SectionApproval(Base):
    """
    Track approval status of chapter sections.
    Each section can be marked ready for review, approved, or have changes requested.
    """
    
    __tablename__ = "section_approvals"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    chapter_id = Column(UUID, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    section_number = Column(Integer, nullable=False)  # Which section (paragraph/block) 0-N
    
    # Content checkpoint
    content_snapshot = Column(Text, nullable=True)  # Snapshot of content when marked ready
    content_hash = Column(String(64), nullable=True)  # Hash to detect changes
    
    # Status and actors
    status = Column(String(50), default="draft")  # draft, ready_for_review, approved, changes_requested
    marked_ready_by = Column(UUID, ForeignKey("users.id"), nullable=True)
    reviewed_by = Column(UUID, ForeignKey("users.id"), nullable=True)
    
    # Review feedback
    review_notes = Column(Text, nullable=True)  # What needs to change
    locked = Column(Boolean, default=False)  # Can't edit if approved
    
    # Timestamps
    marked_ready_at = Column(DateTime, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    chapter = relationship("Chapter", foreign_keys=[chapter_id])
    marked_by_user = relationship("User", foreign_keys=[marked_ready_by])
    reviewed_by_user = relationship("User", foreign_keys=[reviewed_by])
    
    def __repr__(self):
        return f"<SectionApproval(section={self.section_number}, status={self.status})>"
