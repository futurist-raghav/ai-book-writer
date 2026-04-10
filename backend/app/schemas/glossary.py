"""Glossary entry schemas for API validation."""

from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class GlossaryEntryChapterMentions(BaseModel):
    """Chapter mention tracking."""

    chapter_id: str
    count: int


class GlossaryEntryCreate(BaseModel):
    """Create a glossary entry."""

    term: str = Field(..., min_length=1, max_length=255, description="The term")
    definition: Optional[str] = Field(None, description="The definition")
    definition_source: Optional[str] = Field(None, max_length=500, description="Where definition came from")
    part_of_speech: Optional[str] = Field(None, max_length=50, description="noun, verb, etc.")
    context: Optional[str] = Field(None, description="Sample sentences")
    user_defined: bool = Field(False, description="Whether user-created vs extracted")


class GlossaryEntryUpdate(BaseModel):
    """Update a glossary entry."""

    definition: Optional[str] = Field(None, description="The definition")
    definition_source: Optional[str] = Field(None, max_length=500)
    part_of_speech: Optional[str] = Field(None, max_length=50)
    context: Optional[str] = Field(None)
    confirmed: Optional[bool] = Field(None, description="Mark as confirmed")


class GlossaryEntryResponse(BaseModel):
    """Response for glossary entry."""

    id: str
    book_id: str
    term: str
    definition: Optional[str] = None
    definition_source: Optional[str] = None
    confirmed: bool
    part_of_speech: Optional[str] = None
    context: Optional[str] = None
    frequency: int
    chapter_mentions: Optional[dict] = None
    user_defined: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GlossaryExtractionInput(BaseModel):
    """Input for glossary extraction."""

    confidence_threshold: float = Field(0.65, ge=0.0, le=1.0, description="Minimum confidence for extraction")
    max_terms: int = Field(100, ge=1, le=500, description="Maximum terms to extract")
    include_chapters: Optional[List[str]] = Field(None, description="Specific chapters to analyze (None = all)")


class GlossaryExtractionCandidate(BaseModel):
    """A candidate term from glossary extraction."""

    term: str
    frequency: int
    confidence: float
    part_of_speech: Optional[str] = None
    sample_context: Optional[str] = None
    chapter_mentions: Optional[dict] = None
    suggested_definition: Optional[str] = None
    from_chapters: List[str] = Field(default_factory=list)


class GlossaryExtractionResponse(BaseModel):
    """Response for glossary extraction."""

    candidates: List[GlossaryExtractionCandidate]
    analyzed_chapters: int
    total_terms_found: int
    extraction_time_ms: int
    note: str = "Review candidates and confirm which terms to add to glossary"


class GlossaryListResponse(BaseModel):
    """Response for listing glossary entries."""

    entries: List[GlossaryEntryResponse]
    total: int
    confirmed: int
    suggested: int
