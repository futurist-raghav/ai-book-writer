"""Bibliography and Citation Models (P2.4)

Models for managing sources, citations, and bibliography in chapters.
"""

from sqlalchemy import Column, String, Integer, Text, DateTime, Boolean, JSON, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4
from app.core.database import Base
from datetime import datetime


class Bibliography(Base):
    """Bibliography entry (book, article, website, video, etc.)"""

    __tablename__ = 'bibliography'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    book_id = Column(UUID(as_uuid=True), ForeignKey('books.id', ondelete='CASCADE'), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    authors = Column(JSON(), nullable=True)  # ["Author 1", "Author 2", ...]
    year = Column(Integer(), nullable=True)
    source_type = Column(String(50), nullable=True)  # book, article, website, video, etc.
    source_url = Column(String(2000), nullable=True)
    citation_formats = Column(JSON(), nullable=True)  # {apa: "Author (Year)...", mla: "...", chicago: "...", ieee: "..."}
    notes = Column(Text(), nullable=True)
    is_deleted = Column(Boolean(), nullable=False, default=False)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    book = relationship('Book', back_populates='bibliography_entries')
    chapter_citations = relationship('ChapterCitation', back_populates='bibliography', cascade='all, delete-orphan')

    __table_args__ = (
        Index('ix_bibliography_book_id', 'book_id'),
        Index('ix_bibliography_title', 'title'),
    )


class ChapterCitation(Base):
    """Link between chapter and bibliography source with citation context"""

    __tablename__ = 'chapter_citations'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    chapter_id = Column(UUID(as_uuid=True), ForeignKey('chapters.id', ondelete='CASCADE'), nullable=False, index=True)
    bibliography_id = Column(UUID(as_uuid=True), ForeignKey('bibliography.id', ondelete='CASCADE'), nullable=False, index=True)
    page_number = Column(String(50), nullable=True)  # "42" or "42-44" or "p. 42"
    context_offset = Column(Integer(), nullable=True)  # Position in chapter text where citation appears
    context_snippet = Column(Text(), nullable=True)  # Surrounding text (100 chars before/after)
    citation_format = Column(String(20), nullable=False, default='apa')  # apa, mla, chicago, ieee
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    chapter = relationship('Chapter', back_populates='citations')
    bibliography = relationship('Bibliography', back_populates='chapter_citations')

    __table_args__ = (
        Index('ix_chapter_citations_chapter_id', 'chapter_id'),
        Index('ix_chapter_citations_bibliography_id', 'bibliography_id'),
    )
