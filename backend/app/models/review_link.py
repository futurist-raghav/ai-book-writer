"""
ReviewLink and ReviewerComment Models

Store review link metadata and feedback from beta readers.
"""

from typing import TYPE_CHECKING, Optional

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, UUID, ForeignKey, Boolean, Integer, Text, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ReviewLink(Base):
    """Shareable review link for beta reader feedback."""
    __tablename__ = "review_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    share_code: Mapped[str] = mapped_column(String(24), unique=True, nullable=False, index=True)
    
    # Metadata
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False) # User ID who created this
    created_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    expires_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), nullable=False)
    
    # Settings
    allow_comments: Mapped[bool] = mapped_column(Boolean, default=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True) # Hashed password if protected
    chapters_included: Mapped[int] = mapped_column(Integer, default=0) # Number of chapters accessible
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Relationships
    book = relationship("Book", back_populates="review_links")
    comments = relationship("ReviewerComment", back_populates="review_link", cascade="all, delete-orphan")


class ReviewerComment(Base):
    """Feedback left by a beta reader on a specific chapter."""
    __tablename__ = "reviewer_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_link_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("review_links.id", ondelete="CASCADE"), nullable=False)
    chapter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False) # Reference to chapter
    
    # Comment content
    position: Mapped[int] = mapped_column(Integer, default=0) # Character position in chapter
    context_text: Mapped[Optional[str]] = mapped_column(String(500), nullable=True) # ~50-100 words around position
    feedback_text: Mapped[str] = mapped_column(Text, nullable=False) # The actual feedback
    feedback_type: Mapped[str] = mapped_column(String(20), default="general") # general, suggestion, issue, praise
    
    # Reviewer info
    reviewer_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default="Anonymous")
    
    # Metadata
    created_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    is_addressed: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Relationships
    review_link = relationship("ReviewLink", back_populates="comments")
