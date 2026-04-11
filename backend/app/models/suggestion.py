"""
Suggestion Model - Track Changes / Collaborative Editing

Stores suggested edits for chapters in Track Changes style.
Supports accept/reject workflow for collaborative review.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
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


# Legacy TextSuggestion for backwards compatibility (deprecated)
    
    # Metadata
    change_type = Column(String(50), default="edit")  # edit, insert, delete
    confidence_score = Column(Integer, default=100)  # 0-100 AI confidence
    reason = Column(String(200), nullable=True)  # Why the suggestion was made
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    chapter = relationship("Chapter", foreign_keys=[chapter_id])
    author = relationship("User", foreign_keys=[author_id])
    resolver = relationship("User", foreign_keys=[resolved_by])
    
    def __repr__(self):
        status = "accepted" if self.is_accepted else "rejected" if self.is_rejected else "pending"
        return f"<TextSuggestion({self.id}, {status}, {self.change_type})>"
