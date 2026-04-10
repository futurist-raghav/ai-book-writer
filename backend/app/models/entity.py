"""
Entity Model

Unified entity storage for characters, locations, concepts, factions, items, themes, and custom types.
Replaces fragmented entity storage in project_settings JSON.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.book import Book
    from app.models.chapter import Chapter


class EntityType(str, Enum):
    """Entity type enumeration."""

    CHARACTER = "character"
    LOCATION = "location"
    CONCEPT = "concept"
    FACTION = "faction"
    ITEM = "item"
    THEME = "theme"
    CUSTOM = "custom"


class Entity(Base):
    """Unified entity model for characters, locations, concepts, etc."""

    __tablename__ = "entities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Foreign key to book
    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Entity classification
    type: Mapped[str] = mapped_column(
        SAEnum(
            EntityType.CHARACTER.value,
            EntityType.LOCATION.value,
            EntityType.CONCEPT.value,
            EntityType.FACTION.value,
            EntityType.ITEM.value,
            EntityType.THEME.value,
            EntityType.CUSTOM.value,
            name="entity_type_enum",
        ),
        nullable=False,
        server_default=EntityType.CHARACTER.value,
    )

    # Core attributes
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Flexible metadata storage (type-specific fields)
    # For characters: age, gender, personality, background, etc.
    # For locations: geography, climate, political system, etc.
    # For concepts: definition, examples, related_concepts, etc.
    # Named 'entity_metadata' to avoid conflict with SQLAlchemy reserved 'metadata' attribute
    entity_metadata: Mapped[Optional[dict]] = mapped_column(
        "metadata",  # Database column name stays as 'metadata'
        JSONB,
        default=dict,
        nullable=True,
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
    book: Mapped["Book"] = relationship(
        "Book",
        foreign_keys=[book_id],
    )

    def __repr__(self) -> str:
        return f"<Entity {self.name} ({self.type})>"

    @property
    def display_type(self) -> str:
        """Return human-readable entity type."""
        type_map = {
            EntityType.CHARACTER.value: "Character",
            EntityType.LOCATION.value: "Location",
            EntityType.CONCEPT.value: "Concept",
            EntityType.FACTION.value: "Faction",
            EntityType.ITEM.value: "Item",
            EntityType.THEME.value: "Theme",
            EntityType.CUSTOM.value: "Custom",
        }
        return type_map.get(self.type, "Unknown")


class EntityReference(Base):
    """Cross-reference tracking which chapters mention which entities."""

    __tablename__ = "entity_references"
    __table_args__ = (
        UniqueConstraint("entity_id", "chapter_id", name="uq_entity_references_entity_chapter"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Foreign keys
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chapter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chapters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Reference metadata
    mention_count: Mapped[int] = mapped_column(
        Integer(),
        default=1,
        nullable=False,
        doc="Number of times entity is mentioned in chapter",
    )
    first_mention_position: Mapped[Optional[int]] = mapped_column(
        Integer(),
        nullable=True,
        doc="Character position of first mention in chapter",
    )
    context_snippet: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        doc="Text snippet showing entity mention context",
    )

    # Extraction metadata
    extraction_metadata: Mapped[Optional[dict]] = mapped_column(
        JSONB(),
        default=dict,
        nullable=True,
        doc="Metadata from extraction (confidence, tags, etc.)",
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
    entity: Mapped["Entity"] = relationship(
        "Entity",
        foreign_keys=[entity_id],
    )
    chapter: Mapped["Chapter"] = relationship(
        "Chapter",
        foreign_keys=[chapter_id],
    )

    def __repr__(self) -> str:
        return f"<EntityReference entity_id={self.entity_id} -> chapter_id={self.chapter_id} ({self.mention_count} mentions)>"
