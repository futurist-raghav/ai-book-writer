"""
Suggestion Model - Track Changes / Collaborative Editing

Stores suggested edits for chapters in Track Changes style.
Supports accept/reject workflow for collaborative review.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func, Float, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.chapter import Chapter
    from app.models.user import User


class SuggestionType(str, Enum):
    """Types of suggestions."""

    REWRITE = "rewrite"
    EXPAND = "expand"
    SHORTEN = "shorten"
    REPHRASE = "rephrase"
    TONE = "tone"
    GRAMMAR = "grammar"
    STYLE = "style"


class SuggestionStatus(str, Enum):
    """Status of a suggestion."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class ChapterSuggestion(Base):
    """
    Suggestion for a chapter text.
    
    Track Changes style editing: suggest edits instead of direct overwrites.
    Stores before/after text, position, and acceptance status.
    """

    __tablename__ = "chapter_suggestions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    chapter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chapters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Suggestion content
    suggestion_type: Mapped[str] = mapped_column(
        String(50), default=SuggestionType.REWRITE, nullable=False
    )
    text_before: Mapped[str] = mapped_column(Text, nullable=False)
    text_after: Mapped[str] = mapped_column(Text, nullable=False)

    # Position and length in chapter content
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    length: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Optional reason
    reason: Mapped[str] = mapped_column(Text, default="", nullable=True)

    # Status tracking
    status: Mapped[str] = mapped_column(
        String(20), default=SuggestionStatus.PENDING, nullable=False
    )
    acceptance_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    chapter: Mapped["Chapter"] = relationship(back_populates="suggestions")
    author: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[author_id], lazy="joined"
    )

    def __repr__(self) -> str:
        return (
            f"<ChapterSuggestion(id={self.id}, chapter_id={self.chapter_id}, "
            f"type={self.suggestion_type}, status={self.status})>"
        )


class TextSuggestion(Base):
    """
    Legacy TextSuggestion for backwards compatibility (deprecated).
    
    Use ChapterSuggestion for new code.
    """

    __tablename__ = "text_suggestions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    chapter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chapters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Metadata
    change_type: Mapped[str] = mapped_column(String(50), default="edit")  # edit, insert, delete
    confidence_score: Mapped[int] = mapped_column(Integer, default=100)  # 0-100 AI confidence
    reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)  # Why the suggestion was made
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<TextSuggestion({self.id}, {self.change_type})>"
