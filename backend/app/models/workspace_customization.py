"""Workspace Customization Model (P2.5)

Stores per-book workspace customization settings.
"""

from sqlalchemy import Column, String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from uuid import uuid4
from app.core.database import Base
from datetime import datetime


class WorkspaceCustomization(Base):
    """Workspace customization settings per book"""

    __tablename__ = 'workspace_customizations'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    book_id = Column(UUID(as_uuid=True), ForeignKey('books.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
    
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
    layout_preferences = Column(JSONB(), nullable=True, default=dict)
    
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    book = relationship('Book', foreign_keys=[book_id])

    def __repr__(self) -> str:
        return f"<WorkspaceCustomization book_id={self.book_id}>"
