"""
Flow Engine Models: FlowEvents, Timeline, Dependencies

ORM models for managing project events, timeline visualization, and dependencies.
"""

from enum import Enum
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, DateTime, ForeignKey, UniqueConstraint,
    CheckConstraint, func, Index, Table
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class FlowEventType(str, Enum):
    """Flow event type enumeration."""

    SCENE = "scene"
    BEAT = "beat"
    MILESTONE = "milestone"
    ACT = "act"
    CHAPTER = "chapter"
    SUBPLOT = "subplot"
    BRANCH = "branch"
    CUSTOM = "custom"


class FlowEventStatus(str, Enum):
    """Flow event status enumeration."""

    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"


class FlowDependencyType(str, Enum):
    """Dependency type enumeration."""

    BLOCKS = "blocks"  # from_event blocks to_event
    TRIGGERS = "triggers"  # from_event triggers to_event
    FOLLOWS = "follows"  # to_event follows from_event
    REQUIRED_BEFORE = "required_before"  # from_event required before to_event


class FlowEvent(Base):
    """Flow Event model for timeline management."""

    __tablename__ = "flow_events"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    book_id = Column(PG_UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(String(50), nullable=False, default=FlowEventType.BEAT.value)
    timeline_position = Column(Integer, nullable=False, default=0, index=True)
    duration = Column(Integer, nullable=True)  # days/hours/minutes
    status = Column(String(50), nullable=False, default=FlowEventStatus.PLANNED.value)
    order_index = Column(Integer, nullable=False, default=0)
    metadata = Column(JSONB, nullable=True, default={})
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True)
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    book = relationship("Book", backref="flow_events")
    dependencies_from = relationship(
        "FlowDependency",
        foreign_keys="FlowDependency.from_event_id",
        back_populates="from_event",
        cascade="all, delete-orphan",
    )
    dependencies_to = relationship(
        "FlowDependency",
        foreign_keys="FlowDependency.to_event_id",
        back_populates="to_event",
        cascade="all, delete-orphan",
    )
    chapter_associations = relationship(
        "FlowChapterEvent",
        back_populates="flow_event",
        cascade="all, delete-orphan",
    )
    chapters = relationship(
        "Chapter",
        secondary="flow_chapter_events",
        back_populates="flow_events",
        viewonly=True,
    )

    __table_args__ = (
        UniqueConstraint("book_id", "title", name="uq_flow_events_book_title"),
    )

    def __repr__(self) -> str:
        return f"<FlowEvent {self.title} ({self.event_type}) @ position {self.timeline_position}>"


class FlowDependency(Base):
    """Dependency relationships between flow events."""

    __tablename__ = "flow_dependencies"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    from_event_id = Column(PG_UUID(as_uuid=True), ForeignKey("flow_events.id", ondelete="CASCADE"), nullable=False, index=True)
    to_event_id = Column(PG_UUID(as_uuid=True), ForeignKey("flow_events.id", ondelete="CASCADE"), nullable=False, index=True)
    dependency_type = Column(String(50), nullable=False, default=FlowDependencyType.BLOCKS.value)
    metadata = Column(JSONB, nullable=True, default={})
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    from_event = relationship(
        "FlowEvent",
        foreign_keys=[from_event_id],
        back_populates="dependencies_from",
    )
    to_event = relationship(
        "FlowEvent",
        foreign_keys=[to_event_id],
        back_populates="dependencies_to",
    )

    __table_args__ = (
        UniqueConstraint("from_event_id", "to_event_id", name="uq_flow_dependencies"),
        CheckConstraint("from_event_id != to_event_id", name="ck_no_self_dependencies"),
    )

    def __repr__(self) -> str:
        return f"<FlowDependency {self.from_event_id} -{self.dependency_type}-> {self.to_event_id}>"


class FlowChapterEvent(Base):
    """Association between chapters and flow events."""

    __tablename__ = "flow_chapter_events"

    chapter_id = Column(PG_UUID(as_uuid=True), ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False, index=True, primary_key=True)
    event_id = Column(PG_UUID(as_uuid=True), ForeignKey("flow_events.id", ondelete="CASCADE"), nullable=False, index=True, primary_key=True)
    order_index = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    chapter = relationship("Chapter", back_populates="flow_chapter_event_associations")
    flow_event = relationship("FlowEvent", back_populates="chapter_associations")

    def __repr__(self) -> str:
        return f"<FlowChapterEvent chapter={self.chapter_id} event={self.event_id}>"
