"""
Event Model

Stores extracted narrative events from transcriptions.
An event represents a discrete story, incident, or experience.
"""

import uuid
from datetime import date, datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.chapter import Chapter, ChapterEvent
    from app.models.transcription import Transcription
    from app.models.user import User


class EventStatus(str, Enum):
    """Event processing status."""

    DRAFT = "draft"
    EXTRACTED = "extracted"
    REVIEWED = "reviewed"
    APPROVED = "approved"
    ARCHIVED = "archived"


class Event(Base):
    """Event model representing a narrative unit."""

    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Event content
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Original text from transcription (before AI processing)
    original_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Time references in the audio
    audio_start_time: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    audio_end_time: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Categorization
    category: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )  # childhood, education, career, family, etc.
    subcategory: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    tags: Mapped[Optional[list]] = mapped_column(
        ARRAY(String),
        default=list,
        nullable=True,
    )

    # Timeline information
    event_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    event_date_precision: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
    )  # exact, month, year, decade, approximate
    age_at_event: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Location
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    location_details: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        default=dict,
        nullable=True,
    )  # city, country, coordinates, etc.

    # People mentioned
    people: Mapped[Optional[list]] = mapped_column(
        JSONB,
        default=list,
        nullable=True,
    )  # [{"name": "John", "relationship": "father"}, ...]

    # Emotional context
    sentiment: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
    )  # positive, negative, neutral, mixed
    emotions: Mapped[Optional[list]] = mapped_column(
        ARRAY(String),
        default=list,
        nullable=True,
    )  # happy, sad, nostalgic, proud, etc.

    # AI extraction metadata
    extraction_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    extraction_model: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ai_metadata: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        default=dict,
        nullable=True,
    )

    # Status and ordering
    status: Mapped[str] = mapped_column(
        String(20),
        default=EventStatus.EXTRACTED.value,
        nullable=False,
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    transcription_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transcriptions.id", ondelete="SET NULL"),
        nullable=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    transcription: Mapped[Optional["Transcription"]] = relationship(
        "Transcription",
        back_populates="events",
    )
    user: Mapped["User"] = relationship("User", back_populates="events")
    chapter_associations: Mapped[List["ChapterEvent"]] = relationship(
        "ChapterEvent",
        back_populates="event",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Event {self.title}>"

    @property
    def word_count(self) -> int:
        """Return the word count of the event content."""
        if not self.content:
            return 0
        return len(self.content.split())
