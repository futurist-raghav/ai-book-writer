"""Glossary entry ORM model

Provides glossary/term management for P3.8 feature.
"""

from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, ForeignKey, JSON, UniqueConstraint, Index
from sqlalchemy.orm import relationship

from app.core.database import Base


class GlossaryEntry(Base):
    """Glossary entry model for extracting and managing terms.
    
    Supports both AI-extracted and user-defined glossary entries.
    Tracks frequency and chapter mentions for context.
    """

    __tablename__ = 'glossary_entries'

    id = Column(String(36), primary_key=True)
    book_id = Column(String(36), ForeignKey('books.id', ondelete='CASCADE'), nullable=False)
    term = Column(String(255), nullable=False)
    definition = Column(Text, nullable=True)
    definition_source = Column(String(500), nullable=True)  # "Chapter 5: Summary" or URL for web sources
    confirmed = Column(Boolean, nullable=False, default=False)
    part_of_speech = Column(String(50), nullable=True)  # noun, verb, adjective, adverb, proper_noun
    context = Column(Text, nullable=True)  # sample sentences with term
    frequency = Column(Integer, nullable=False, default=1)  # total mentions across all chapters
    chapter_mentions = Column(JSON, nullable=True)  # {"chapter_id": count, ...}
    user_defined = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    book = relationship('Book', back_populates='glossary_entries')

    __table_args__ = (
        UniqueConstraint('book_id', 'term', name='uq_book_glossary_term'),
        Index('ix_glossary_entries_book_id', 'book_id'),
        Index('ix_glossary_entries_confirmed', 'book_id', 'confirmed'),
    )
