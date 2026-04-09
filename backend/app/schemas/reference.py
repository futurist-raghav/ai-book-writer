"""
Reference Schemas

Request and response schemas for reference/citation-related endpoints.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import BaseSchema, IDMixin, TimestampMixin


# ============== Request Schemas ==============


class ReferenceCreate(BaseModel):
    """Schema for creating a new reference."""

    source_type: str = Field(default="book", description="Type of source")
    title: str = Field(..., max_length=500, description="Title of the reference")
    authors: List[str] = Field(default_factory=list, description="List of author names")
    url: Optional[str] = Field(None, max_length=1000, description="URL to the source")
    metadata: dict = Field(default_factory=dict, description="Source-specific metadata")
    notes: Optional[str] = None
    tags: List[str] = Field(default_factory=list, description="Tags for organization")
    citation_format: str = Field(default="apa", description="Preferred citation format")


class ReferenceUpdate(BaseModel):
    """Schema for updating an existing reference."""

    source_type: Optional[str] = None
    title: Optional[str] = Field(None, max_length=500)
    authors: Optional[List[str]] = None
    url: Optional[str] = Field(None, max_length=1000)
    metadata: Optional[dict] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    citation_format: Optional[str] = None


class ReferenceGenerateCitations(BaseModel):
    """Schema for generating citations in different formats."""

    formats: List[str] = Field(
        default=["apa", "mla", "chicago", "ieee", "harvard"],
        description="Citation formats to generate",
    )


# ============== Response Schemas ==============


class ReferenceResponse(BaseSchema, IDMixin, TimestampMixin):
    """Schema for reference response."""

    book_id: UUID
    source_type: str
    title: str
    authors: List[str]
    url: Optional[str] = None
    metadata: dict
    notes: Optional[str] = None
    tags: List[str]
    citation_format: str
    apa_citation: Optional[str] = None
    mla_citation: Optional[str] = None
    chicago_citation: Optional[str] = None
    ieee_citation: Optional[str] = None
    harvard_citation: Optional[str] = None


class ReferenceListResponse(BaseModel):
    """Schema for list of references response."""

    data: List[ReferenceResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class BibliographyResponse(BaseModel):
    """Schema for bibliography export response."""

    format: str = Field(description="Citation format (apa, mla, chicago, ieee, harvard)")
    content: str = Field(description="Formatted bibliography content")
    entry_count: int
    generated_at: datetime
