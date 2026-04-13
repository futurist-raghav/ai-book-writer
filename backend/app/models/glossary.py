"""Glossary entry ORM model

Provides glossary/term management for P3.8 feature.
"""

from typing import TYPE_CHECKING, Optional

from datetime import datetime
from sqlalchemy import String, Text, Boolean, Integer, DateTime, ForeignKey, JSON, UniqueConstraint, Index, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class GlossaryEntry(Base):
    """Glossary entry model for extracting and managing terms.
    
    Supports both AI-extracted and user-defined glossary entries.
    Tracks frequency and chapter mentions for context.
    """

    __tablename__ = 'glossary_entries'

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    book_id: Mapped[str] = mapped_column(String(36), ForeignKey('books.id', ondelete='CASCADE'), nullable=False)
    term: Mapped[str] = mapped_column(String(255), nullable=False)
    definition: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    definition_source: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # "Chapter 5: Summary" or URL for web sources
    confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    part_of_speech: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # noun, verb, adjective, adverb, proper_noun
    context: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # sample sentences with term
    frequency: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # total mentions across all chapters
    chapter_mentions: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # {"chapter_id": count, ...}
    user_defined: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    book = relationship('Book', back_populates='glossary_entries')

    __table_args__ = (
        UniqueConstraint('book_id', 'term', name='uq_book_glossary_term'),
        Index('ix_glossary_entries_book_id', 'book_id'),
        Index('ix_glossary_entries_confirmed', 'book_id', 'confirmed'),
    )
