"""
Comment and Reply Models

Store comments on chapters with mention and thread tracking.
"""

from typing import TYPE_CHECKING, Optional

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, UUID, ForeignKey, Boolean, Integer, Text, Table, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ChapterComment(Base):
    """Comment on a chapter."""
    __tablename__ = "chapter_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Comment content
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # For inline comments
    position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True) # Character position in chapter
    context_text: Mapped[Optional[str]] = mapped_column(String(500), nullable=True) # Surrounding text
    
    # Mentions
    mentioned_users: Mapped[dict] = mapped_column(JSON, default=[]) # List of user IDs mentioned
    
    # Status
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True) # User who resolved
    resolved_at: Mapped[Optional[datetime.time]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    created_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[Optional[datetime.time]] = mapped_column(DateTime(timezone=True), nullable=True)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    
    # Relationships
    chapter = relationship("Chapter", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])
    replies = relationship("CommentReply", back_populates="comment", cascade="all, delete-orphan")


class CommentReply(Base):
    """Reply to a comment."""
    __tablename__ = "comment_replies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    comment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chapter_comments.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Content
    content: Mapped[str] = mapped_column(Text, nullable=False)
    mentioned_users: Mapped[dict] = mapped_column(JSON, default=[]) # List of user IDs mentioned
    
    # Metadata
    created_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[Optional[datetime.time]] = mapped_column(DateTime(timezone=True), nullable=True)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    
    # Relationships
    comment = relationship("ChapterComment", back_populates="replies")
    author = relationship("User", foreign_keys=[author_id])


class CommentNotification(Base):
    """Notification for comment activity."""
    __tablename__ = "comment_notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    comment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chapter_comments.id", ondelete="CASCADE"), nullable=False)
    
    # Notification details
    item_type: Mapped[str] = mapped_column(String(20), nullable=False) # "mention", "reply", "resolved"
    trigger_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False) # Who triggered the notification
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    comment = relationship("ChapterComment")
