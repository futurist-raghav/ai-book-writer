"""Pydantic schemas for Bibliography and Citations (P2.4)"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


# ============================================================================
# Bibliography Schemas
# ============================================================================

class BibliographyCreateRequest(BaseModel):
    """Request to create a bibliography entry"""
    title: str = Field(..., description="Title of the source")
    authors: Optional[List[str]] = Field(None, description="List of author names")
    year: Optional[int] = Field(None, description="Publication year")
    source_type: Optional[str] = Field(None, description="book, article, website, video, etc.")
    source_url: Optional[str] = Field(None, description="URL to the source")
    notes: Optional[str] = Field(None, description="Additional notes about the source")


class BibliographyUpdateRequest(BaseModel):
    """Request to update a bibliography entry"""
    title: Optional[str] = Field(None, description="Title of the source")
    authors: Optional[List[str]] = Field(None, description="List of author names")
    year: Optional[int] = Field(None, description="Publication year")
    source_type: Optional[str] = Field(None, description="book, article, website, video, etc.")
    source_url: Optional[str] = Field(None, description="URL to the source")
    notes: Optional[str] = Field(None, description="Additional notes about the source")


class BibliographyResponse(BaseModel):
    """Response with bibliography entry"""
    id: UUID
    book_id: UUID
    title: str
    authors: Optional[List[str]]
    year: Optional[int]
    source_type: Optional[str]
    source_url: Optional[str]
    citation_formats: Optional[Dict[str, str]]  # {apa: "...", mla: "...", chicago: "...", ieee: "..."}
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BibliographyListResponse(BaseModel):
    """Response with list of bibliography entries"""
    items: List[BibliographyResponse]
    total: int
    page: int
    page_size: int


# ============================================================================
# Chapter Citation Schemas
# ============================================================================

class ChapterCitationCreateRequest(BaseModel):
    """Request to link a chapter to a bibliography source"""
    bibliography_id: UUID = Field(..., description="ID of the bibliography entry")
    page_number: Optional[str] = Field(None, description="Page number (e.g., '42' or '42-44')")
    context_offset: Optional[int] = Field(None, description="Character position in chapter where citation appears")
    context_snippet: Optional[str] = Field(None, description="Text surrounding the citation (100 chars before/after)")
    citation_format: str = Field("apa", description="Citation format: apa, mla, chicago, ieee")


class ChapterCitationUpdateRequest(BaseModel):
    """Request to update a chapter citation"""
    page_number: Optional[str] = Field(None, description="Page number")
    context_offset: Optional[int] = Field(None, description="Character position")
    context_snippet: Optional[str] = Field(None, description="Text surrounding citation")
    citation_format: Optional[str] = Field(None, description="Citation format")


class ChapterCitationResponse(BaseModel):
    """Response with chapter citation"""
    id: UUID
    chapter_id: UUID
    bibliography_id: UUID
    page_number: Optional[str]
    context_offset: Optional[int]
    context_snippet: Optional[str]
    citation_format: str
    bibliography: BibliographyResponse  # Nested bibliography info
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChapterCitationsListResponse(BaseModel):
    """Response with list of chapter citations"""
    items: List[ChapterCitationResponse]
    total: int


# ============================================================================
# Bibliography with Formatted Citations
# ============================================================================

class FormattedCitationResponse(BaseModel):
    """Bibliography entry with pre-formatted citations in multiple formats"""
    id: UUID
    title: str
    authors: Optional[List[str]]
    year: Optional[int]
    source_type: Optional[str]
    apa: str = Field(..., description="APA formatted citation")
    mla: str = Field(..., description="MLA formatted citation")
    chicago: str = Field(..., description="Chicago formatted citation")
    ieee: str = Field(..., description="IEEE formatted citation")
    citation_count: int = Field(0, description="Number of chapters citing this source")

    class Config:
        from_attributes = True


class ChapterBibliographyResponse(BaseModel):
    """Chapter with all bibliography sources and formatted citations for export"""
    chapter_id: UUID
    chapter_title: str
    citations: List[ChapterCitationResponse]
    formatted_bibliography: List[FormattedCitationResponse]
    bibliography_text: str = Field(..., description="Pre-formatted bibliography text for export")

    class Config:
        from_attributes = True
