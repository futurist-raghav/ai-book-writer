"""
Chapter Model

Stores book chapters composed of events.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.book import Book, BookChapter
    from app.models.chapter_version import ChapterVersion
    from app.models.collaboration import Activity
    from app.models.event import Event
    from app.models.flow_engine import FlowChapterEvent, FlowEvent
    from app.models.user import User
    from app.models.event import Event
    from app.models.user import User


class ChapterStatus(str, Enum):
    """Chapter status."""

    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ChapterWorkflowStatus(str, Enum):
    """Editorial workflow status for chapters."""

    IDEA = "idea"
    OUTLINE = "outline"
    DRAFT = "draft"
    REVISION = "revision"
    FINAL = "final"


class Chapter(Base):
    """Chapter model."""

    __tablename__ = "chapters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Chapter content
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subtitle: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Chapter number and ordering
    chapter_number: Mapped[int] = mapped_column(Integer, default=1)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    chapter_type: Mapped[str] = mapped_column(String(50), default="chapter", nullable=False)

    # Content settings
    writing_style: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    tone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Status
    status: Mapped[str] = mapped_column(
        String(20),
        default=ChapterStatus.DRAFT.value,
        nullable=False,
    )
    workflow_status: Mapped[str] = mapped_column(
        String(20),
        default=ChapterWorkflowStatus.DRAFT.value,
        nullable=False,
    )
    word_count_target: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    timeline_position: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    # AI generation settings
    generation_settings: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        default=dict,
        nullable=True,
    )
    ai_enhancement_enabled: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Compiled content (generated from events)
    compiled_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_compiled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Owner
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
    user: Mapped["User"] = relationship("User", back_populates="chapters")
    event_associations: Mapped[List["ChapterEvent"]] = relationship(
        "ChapterEvent",
        back_populates="chapter",
        cascade="all, delete-orphan",
        order_by="ChapterEvent.order_index",
    )
    flow_chapter_event_associations: Mapped[List["FlowChapterEvent"]] = relationship(
        "FlowChapterEvent",
        back_populates="chapter",
        cascade="all, delete-orphan",
        order_by="FlowChapterEvent.order_index",
    )
    book_associations: Mapped[List["BookChapter"]] = relationship(
        "BookChapter",
        back_populates="chapter",
        cascade="all, delete-orphan",
    )
    versions: Mapped[List["ChapterVersion"]] = relationship(
        "ChapterVersion",
        back_populates="chapter",
        cascade="all, delete-orphan",
        order_by="ChapterVersion.created_at.desc()",
    )
    flow_events: Mapped[List["FlowEvent"]] = relationship(
        "FlowEvent",
        secondary="flow_chapter_events",
        back_populates="chapters",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return f"<Chapter {self.chapter_number}: {self.title}>"

    @property
    def word_count(self) -> int:
        """Return the word count of compiled content."""
        if not self.compiled_content:
            return 0
        return len(self.compiled_content.split())

    @property
    def events(self) -> List["Event"]:
        """Return list of events in this chapter."""
        return [assoc.event for assoc in self.event_associations]

    @property
    def target_progress_percent(self) -> Optional[float]:
        """Return completion progress against chapter target words."""
        if not self.word_count_target or self.word_count_target <= 0:
            return None
        progress = (self.word_count / self.word_count_target) * 100
        return round(min(progress, 100.0), 2)


class ChapterEvent(Base):
    """Association table for Chapter-Event many-to-many relationship."""

    __tablename__ = "chapter_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    chapter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chapters.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Order within the chapter
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    # Custom content for this event in this chapter (overrides event.content)
    custom_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Transition text to next event
    transition_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationships
    chapter: Mapped["Chapter"] = relationship(
        "Chapter",
        back_populates="event_associations",
    )
    event: Mapped["Event"] = relationship(
        "Event",
        back_populates="chapter_associations",
    )
