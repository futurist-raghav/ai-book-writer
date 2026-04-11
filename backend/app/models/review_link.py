"""
ReviewLink and ReviewerComment Models

Store review link metadata and feedback from beta readers.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, UUID, ForeignKey, Boolean, Integer, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class ReviewLink(Base):
    """Shareable review link for beta reader feedback."""
    __tablename__ = "review_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    share_code = Column(String(24), unique=True, nullable=False, index=True)
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), nullable=False)  # User ID who created this
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False)
    
    # Settings
    allow_comments = Column(Boolean, default=True)
    password_hash = Column(String(255), nullable=True)  # Hashed password if protected
    chapters_included = Column(Integer, default=0)  # Number of chapters accessible
    is_active = Column(Boolean, default=True)
    
    # Relationships
    book = relationship("Book", back_populates="review_links")
    comments = relationship("ReviewerComment", back_populates="review_link", cascade="all, delete-orphan")


class ReviewerComment(Base):
    """Feedback left by a beta reader on a specific chapter."""
    __tablename__ = "reviewer_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_link_id = Column(UUID(as_uuid=True), ForeignKey("review_links.id", ondelete="CASCADE"), nullable=False)
    chapter_id = Column(UUID(as_uuid=True), nullable=False)  # Reference to chapter
    
    # Comment content
    position = Column(Integer, default=0)  # Character position in chapter
    context_text = Column(String(500), nullable=True)  # ~50-100 words around position
    feedback_text = Column(Text, nullable=False)  # The actual feedback
    feedback_type = Column(String(20), default="general")  # general, suggestion, issue, praise
    
    # Reviewer info
    reviewer_name = Column(String(100), nullable=True, default="Anonymous")
    
    # Metadata
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    is_addressed = Column(Boolean, default=False)
    
    # Relationships
    review_link = relationship("ReviewLink", back_populates="comments")
