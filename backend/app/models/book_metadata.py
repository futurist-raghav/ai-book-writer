"""Book metadata configuration for publishing and distribution."""

from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import String, Text, DateTime, Boolean, Integer, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class BookMetadata(Base):
    """Comprehensive metadata for book publishing and distribution."""

    __tablename__ = "book_metadata"

    # Primary Key
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))

    # Foreign Key
    book_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)

    # Author Information
    author_name: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    author_bio: Mapped[Optional[str]] = mapped_column(Text, default=None)  # Up to 500 words
    author_website: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    author_email: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    author_social_links: Mapped[Optional[str]] = mapped_column(Text, default=None)  # JSON object

    # Publishing Information
    publisher_name: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    imprint_name: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    publication_year: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    publication_date: Mapped[Optional[DateTime]] = mapped_column(DateTime, default=None)

    # Identifiers
    isbn_10: Mapped[Optional[str]] = mapped_column(String(13), default=None)  # 10-digit
    isbn_13: Mapped[Optional[str]] = mapped_column(String(17), default=None)  # 13-digit with hyphens
    issn: Mapped[Optional[str]] = mapped_column(String(9), default=None)  # 8-digit + hyphen
    oclc_number: Mapped[Optional[str]] = mapped_column(String(50), default=None)

    # Copyright & Licensing
    copyright_year: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    copyright_holder: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    copyright_notice: Mapped[Optional[str]] = mapped_column(Text, default=None)
    license_type: Mapped[Optional[str]] = mapped_column(
        String(50), default=None
    )  # "all-rights-reserved", "cc-by", "cc-by-sa", etc.
    rights_statement: Mapped[Optional[str]] = mapped_column(Text, default=None)

    # Series Information
    series_name: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    series_volume: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    series_position: Mapped[Optional[str]] = mapped_column(String(50), default=None)  # "Book 5 of 10"

    # Classification
    genre: Mapped[Optional[str]] = mapped_column(String(100), default=None)
    subgenre: Mapped[Optional[str]] = mapped_column(String(100), default=None)
    bisac_code: Mapped[Optional[str]] = mapped_column(String(50), default=None)  # Book Industry Standards
    subject_categories: Mapped[Optional[str]] = mapped_column(
        Text, default=None
    )  # JSON array of category strings

    # Keywords & Discoverability
    keywords: Mapped[Optional[str]] = mapped_column(String(500), default=None)  # Comma-separated
    hashtags: Mapped[Optional[str]] = mapped_column(String(500), default=None)  # Comma-separated
    description_short: Mapped[Optional[str]] = mapped_column(
        String(160), default=None
    )  # Meta description, 160 chars
    description_long: Mapped[Optional[str]] = mapped_column(Text, default=None)  # Full book description

    # Languages
    primary_language: Mapped[Optional[str]] = mapped_column(String(5), default="en")  # ISO 639-1 code
    additional_languages: Mapped[Optional[str]] = mapped_column(
        String(100), default=None
    )  # Comma-separated ISO codes

    # Contributors
    editor_name: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    illustrator_name: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    translator_name: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    contributors: Mapped[Optional[str]] = mapped_column(Text, default=None)  # JSON array of contributor objects

    # Edition & Versioning
    edition_number: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    edition_name: Mapped[Optional[str]] = mapped_column(String(100), default=None)  # "Revised Edition", "Special Edition"
    print_edition: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    ebook_edition: Mapped[Optional[int]] = mapped_column(Integer, default=None)

    # Physical Book Properties
    page_count: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    word_count: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    reading_level: Mapped[Optional[str]] = mapped_column(
        String(50), default=None
    )  # "Young Adult", "Academic", etc.
    age_group: Mapped[Optional[str]] = mapped_column(String(50), default=None)  # "8-12", "15+", etc.

    # Distribution & Rights
    rights_region: Mapped[Optional[str]] = mapped_column(
        String(100), default="worldwide"
    )  # "USA", "EU", "worldwide"
    exclusive_distribution: Mapped[bool] = mapped_column(default=False)
    distribution_territories: Mapped[Optional[str]] = mapped_column(
        Text, default=None
    )  # JSON array of country codes

    # Awards & Recognition
    awards: Mapped[Optional[str]] = mapped_column(Text, default=None)  # JSON array of award objects
    accolades: Mapped[Optional[str]] = mapped_column(
        Text, default=None
    )  # Quotes from reviews, testimonials, etc.

    # Marketing & Social
    marketing_pitch: Mapped[Optional[str]] = mapped_column(Text, default=None)  # One-liner marketing message
    pre_order_url: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    purchase_urls: Mapped[Optional[str]] = mapped_column(
        Text, default=None
    )  # JSON object with platform URLs (Amazon, Apple, etc.)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<BookMetadata book_id={self.book_id} author={self.author_name}>"
