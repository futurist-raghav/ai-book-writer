"""Schemas for book metadata."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, HttpUrl


class ContributorInfo(BaseModel):
    """Information about a book contributor."""

    name: str
    role: str = Field(..., description="e.g., 'editor', 'illustrator', 'translator', 'cover-designer'")
    bio: Optional[str] = None


class AwardInfo(BaseModel):
    """Information about an award or recognition."""

    name: str
    year: Optional[int] = None
    category: Optional[str] = None
    description: Optional[str] = None


class BookMetadataUpdate(BaseModel):
    """Update payload for book metadata."""

    # Author Information
    author_name: Optional[str] = None
    author_bio: Optional[str] = None
    author_website: Optional[str] = None
    author_email: Optional[str] = None
    author_social_links: Optional[str] = None

    # Publishing Information
    publisher_name: Optional[str] = None
    imprint_name: Optional[str] = None
    publication_year: Optional[int] = None
    publication_date: Optional[datetime] = None

    # Identifiers
    isbn_10: Optional[str] = None
    isbn_13: Optional[str] = None
    issn: Optional[str] = None
    oclc_number: Optional[str] = None

    # Copyright & Licensing
    copyright_year: Optional[int] = None
    copyright_holder: Optional[str] = None
    copyright_notice: Optional[str] = None
    license_type: Optional[str] = None
    rights_statement: Optional[str] = None

    # Series Information
    series_name: Optional[str] = None
    series_volume: Optional[int] = None
    series_position: Optional[str] = None

    # Classification
    genre: Optional[str] = None
    subgenre: Optional[str] = None
    bisac_code: Optional[str] = None
    subject_categories: Optional[str] = None

    # Keywords & Discoverability
    keywords: Optional[str] = None
    hashtags: Optional[str] = None
    description_short: Optional[str] = None
    description_long: Optional[str] = None

    # Languages
    primary_language: Optional[str] = None
    additional_languages: Optional[str] = None

    # Contributors
    editor_name: Optional[str] = None
    illustrator_name: Optional[str] = None
    translator_name: Optional[str] = None
    contributors: Optional[str] = None

    # Edition & Versioning
    edition_number: Optional[int] = None
    edition_name: Optional[str] = None
    print_edition: Optional[int] = None
    ebook_edition: Optional[int] = None

    # Physical Book Properties
    page_count: Optional[int] = None
    word_count: Optional[int] = None
    reading_level: Optional[str] = None
    age_group: Optional[str] = None

    # Distribution & Rights
    rights_region: Optional[str] = None
    exclusive_distribution: Optional[bool] = None
    distribution_territories: Optional[str] = None

    # Awards & Recognition
    awards: Optional[str] = None
    accolades: Optional[str] = None

    # Marketing & Social
    marketing_pitch: Optional[str] = None
    pre_order_url: Optional[str] = None
    purchase_urls: Optional[str] = None


class BookMetadataResponse(BaseModel):
    """Complete book metadata response."""

    id: str
    book_id: str

    # Author Information
    author_name: Optional[str]
    author_bio: Optional[str]
    author_website: Optional[str]
    author_email: Optional[str]
    author_social_links: Optional[str]

    # Publishing Information
    publisher_name: Optional[str]
    imprint_name: Optional[str]
    publication_year: Optional[int]
    publication_date: Optional[datetime]

    # Identifiers
    isbn_10: Optional[str]
    isbn_13: Optional[str]
    issn: Optional[str]
    oclc_number: Optional[str]

    # Copyright & Licensing
    copyright_year: Optional[int]
    copyright_holder: Optional[str]
    copyright_notice: Optional[str]
    license_type: Optional[str]
    rights_statement: Optional[str]

    # Series Information
    series_name: Optional[str]
    series_volume: Optional[int]
    series_position: Optional[str]

    # Classification
    genre: Optional[str]
    subgenre: Optional[str]
    bisac_code: Optional[str]
    subject_categories: Optional[str]

    # Keywords & Discoverability
    keywords: Optional[str]
    hashtags: Optional[str]
    description_short: Optional[str]
    description_long: Optional[str]

    # Languages
    primary_language: Optional[str]
    additional_languages: Optional[str]

    # Contributors
    editor_name: Optional[str]
    illustrator_name: Optional[str]
    translator_name: Optional[str]
    contributors: Optional[str]

    # Edition & Versioning
    edition_number: Optional[int]
    edition_name: Optional[str]
    print_edition: Optional[int]
    ebook_edition: Optional[int]

    # Physical Book Properties
    page_count: Optional[int]
    word_count: Optional[int]
    reading_level: Optional[str]
    age_group: Optional[str]

    # Distribution & Rights
    rights_region: Optional[str]
    exclusive_distribution: bool
    distribution_territories: Optional[str]

    # Awards & Recognition
    awards: Optional[str]
    accolades: Optional[str]

    # Marketing & Social
    marketing_pitch: Optional[str]
    pre_order_url: Optional[str]
    purchase_urls: Optional[str]

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
