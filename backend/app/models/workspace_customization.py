"""Workspace Customization Model (P2.5)

Stores per-book workspace customization settings.
"""

from typing import TYPE_CHECKING, Optional
import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, func, Float, Integer, Boolean, Column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class WorkspaceCustomization(Base):
    """Workspace customization settings per book"""

    __tablename__ = 'workspace_customizations'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('books.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
    
    # Terminology customization
    terminology = Column(JSONB(), nullable=False, default=lambda: {
        "characters_label": "Characters",
        "world_building_label": "World Building",
        "timeline_label": "Timeline",
        "flow_label": "Outline",
        "notes_label": "Notes",
        "references_label": "References",
        "part_singular": "Part",
        "part_plural": "Parts",
        "chapter_singular": "Chapter",
        "chapter_plural": "Chapters",
        "section_singular": "Section",
        "section_plural": "Sections",
    })
    
    # Layout preferences (sidebar state, panel widths, etc.)
    layout_preferences: Mapped[Optional[dict]] = mapped_column(JSONB(), nullable=True, default=dict)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(), nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    book = relationship('Book', foreign_keys=[book_id])

    def __repr__(self) -> str:
        return f"<WorkspaceCustomization book_id={self.book_id}>"
