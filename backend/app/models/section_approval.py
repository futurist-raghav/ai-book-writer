"""
Chapter Section Approval Model

Tracks approval status of sections within chapters.
"""

from typing import TYPE_CHECKING, Optional

from datetime import datetime, timezone
import uuid

from sqlalchemy import String, Text, UUID, DateTime, Boolean, ForeignKey, Integer, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SectionApproval(Base):
    """
    Track approval status of chapter sections.
    Each section can be marked ready for review, approved, or have changes requested.
    """
    
    __tablename__ = "section_approvals"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    chapter_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    section_number: Mapped[int] = mapped_column(Integer, nullable=False)  # Which section (paragraph/block) 0-N
    
    # Content checkpoint
    content_snapshot: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Snapshot of content when marked ready
    content_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # Hash to detect changes
    
    # Status and actors
    status: Mapped[str] = mapped_column(String(50), default="draft")  # draft, ready_for_review, approved, changes_requested
    marked_ready_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID, ForeignKey("users.id"), nullable=True)
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID, ForeignKey("users.id"), nullable=True)
    
    # Review feedback
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # What needs to change
    locked: Mapped[bool] = mapped_column(Boolean, default=False)  # Can't edit if approved
    
    # Timestamps
    marked_ready_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    chapter = relationship("Chapter", foreign_keys=[chapter_id])
    marked_by_user = relationship("User", foreign_keys=[marked_ready_by])
    reviewed_by_user = relationship("User", foreign_keys=[reviewed_by])
    
    def __repr__(self):
        return f"<SectionApproval(section={self.section_number}, status={self.status})>"
