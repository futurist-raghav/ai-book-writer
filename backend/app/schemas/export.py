"""
Export Schemas

Request and response schemas for export/publishing-related endpoints.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import BaseSchema, IDMixin, TimestampMixin


# ============== Request Schemas ==============


class ExportOptions(BaseModel):
    """Export configuration options."""

    include_frontmatter: bool = Field(True, description="Include front matter (dedication, preface, etc)")
    include_backmatter: bool = Field(True, description="Include back matter (afterword, about author, etc)")
    include_toc: bool = Field(True, description="Include table of contents")
    page_size: str = Field("a4", description="Page size (a4, letter, a5)")
    font_size: int = Field(12, ge=8, le=24, description="Base font size in points")
    line_spacing: float = Field(1.5, ge=1.0, le=2.5, description="Line spacing multiplier")
    column_count: int = Field(1, ge=1, le=2, description="Number of columns")

    # Publishing metadata
    isbn: Optional[str] = Field(None, description="ISBN-13 number")
    publisher: Optional[str] = Field(None, description="Publisher name")
    imprint: Optional[str] = Field(None, description="Imprint name")
    publication_date: Optional[str] = Field(None, description="Publication date (ISO format)")
    copyright_year: Optional[int] = Field(None, description="Copyright year")
    language: Optional[str] = Field("en", description="Language code")


class ExportCreate(BaseModel):
    """Schema for creating an export."""

    format: str = Field(
        ...,
        description="Export format",
        pattern="^(pdf|epub|docx|markdown|latex|fountain|html|json)$",
    )
    options: ExportOptions = Field(default_factory=ExportOptions)
    title: Optional[str] = None
    description: Optional[str] = None


# ============== Response Schemas ==============


class ExportResponse(BaseSchema, IDMixin, TimestampMixin):
    """Schema for export response."""

    book_id: UUID
    format: str
    status: str
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    error_message: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    initiated_by: Optional[UUID] = None


class ExportListResponse(BaseModel):
    """Schema for list of exports."""

    data: List[ExportResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ExportProgressResponse(BaseModel):
    """Schema for export progress."""

    export_id: UUID
    status: str
    progress_percent: int = Field(0, ge=0, le=100)
    current_step: Optional[str] = None
    estimated_time_remaining: Optional[int] = None


class ExportMetadataResponse(BaseModel):
    """Schema for export metadata."""

    book_id: UUID
    title: str
    author: Optional[str] = None
    description: Optional[str] = None
    word_count: int
    chapter_count: int
    estimated_pages: int
    available_formats: List[str] = Field(
        default=["pdf", "epub", "docx", "markdown", "latex", "fountain", "html", "json"]
    )


class ExportDownloadResponse(BaseModel):
    """Schema for export download response."""

    export_id: UUID
    file_name: str
    file_size: int
    download_url: str
    expires_at: datetime
    format: str
