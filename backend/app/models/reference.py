"""
Reference Model

Stores citations, bibliography entries, and research references for projects.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.book import Book


class SourceType(str, Enum):
    """Type of reference source."""

    BOOK = "book"
    ARTICLE = "article"
    WEBSITE = "website"
    PAPER = "paper"
    VIDEO = "video"
    PODCAST = "podcast"
    INTERVIEW = "interview"
    PERSONAL_COMMUNICATION = "personal_communication"
    THESIS = "thesis"
    REPORT = "report"


class CitationFormat(str, Enum):
    """Citation format."""

    APA = "apa"
    MLA = "mla"
    CHICAGO = "chicago"
    IEEE = "ieee"
    HARVARD = "harvard"


class Reference(Base):
    """Reference (citation/bibliography entry) model."""

    __tablename__ = "references"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Book relationship
    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    book: Mapped["Book"] = relationship(
        "Book",
        foreign_keys=[book_id],
        back_populates="references",
    )

    # Reference metadata
    source_type: Mapped[str] = mapped_column(
        String(50),
        default=SourceType.BOOK.value,
        nullable=False,
    )

    # Core citation fields
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    authors: Mapped[list[str]] = mapped_column(
        ARRAY(String(255)),
        default=list,
        nullable=False,
    )
    url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # Source-specific fields stored as JSONB
    metadata: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )
    # metadata can contain:
    # - For books: publisher, isbn, year, edition, pages, doi
    # - For articles: journal, issue, volume, pages, doi, issn
    # - For websites: accessed_date, website_name
    # - For papers: conference, year, doi, pages
    # - For videos: channel, duration, published_date
    # - For podcasts: episode, season, series
    # - For interviews: interviewee, organization, date
    # - For thesis: institution, degree, year

    # Notes and tags
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String(100)),
        default=list,
        nullable=False,
    )

    # Citation formatting
    citation_format: Mapped[str] = mapped_column(
        String(20),
        default=CitationFormat.APA.value,
        nullable=False,
    )

    # Generated citations (cached for efficiency)
    apa_citation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mla_citation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    chicago_citation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ieee_citation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    harvard_citation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Reference {self.title} ({self.source_type})>"
