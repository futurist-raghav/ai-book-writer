"""
Comment and Reply Models

Store comments on chapters with mention and thread tracking.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, UUID, ForeignKey, Boolean, Integer, Text, Table, JSON
from sqlalchemy.orm import relationship

from app.core.database import Base


class ChapterComment(Base):
    """Comment on a chapter."""
    __tablename__ = "chapter_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapter_id = Column(UUID(as_uuid=True), ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Comment content
    content = Column(Text, nullable=False)
    
    # For inline comments
    position = Column(Integer, nullable=True)  # Character position in chapter
    context_text = Column(String(500), nullable=True)  # Surrounding text
    
    # Mentions
    mentioned_users = Column(JSON, default=[])  # List of user IDs mentioned
    
    # Status
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(UUID(as_uuid=True), nullable=True)  # User who resolved
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=True)
    likes = Column(Integer, default=0)
    
    # Relationships
    chapter = relationship("Chapter", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])
    replies = relationship("CommentReply", back_populates="comment", cascade="all, delete-orphan")


class CommentReply(Base):
    """Reply to a comment."""
    __tablename__ = "comment_replies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    comment_id = Column(UUID(as_uuid=True), ForeignKey("chapter_comments.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Content
    content = Column(Text, nullable=False)
    mentioned_users = Column(JSON, default=[])  # List of user IDs mentioned
    
    # Metadata
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=True)
    likes = Column(Integer, default=0)
    
    # Relationships
    comment = relationship("ChapterComment", back_populates="replies")
    author = relationship("User", foreign_keys=[author_id])


class CommentNotification(Base):
    """Notification for comment activity."""
    __tablename__ = "comment_notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    comment_id = Column(UUID(as_uuid=True), ForeignKey("chapter_comments.id", ondelete="CASCADE"), nullable=False)
    
    # Notification details
    type = Column(String(20), nullable=False)  # "mention", "reply", "resolved"
    trigger_user_id = Column(UUID(as_uuid=True), nullable=False)  # Who triggered the notification
    message = Column(String(500), nullable=False)
    is_read = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    comment = relationship("ChapterComment")
