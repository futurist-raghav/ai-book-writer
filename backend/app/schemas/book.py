"""
Book Schemas

Request and response schemas for book-related endpoints.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.chapter import ChapterListResponse
from app.schemas.common import BaseSchema, IDMixin, TimestampMixin


# ============== Request Schemas ==============


class BookCreate(BaseModel):
    """Schema for creating a book."""

    title: str = Field(..., max_length=255)
    subtitle: Optional[str] = Field(None, max_length=255)
    author_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    book_type: Optional[str] = Field(None, max_length=50)
    genres: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    chapter_ids: Optional[List[UUID]] = None  # Chapters to include


class BookUpdate(BaseModel):
    """Schema for updating a book."""

    title: Optional[str] = Field(None, max_length=255)
    subtitle: Optional[str] = Field(None, max_length=255)
    author_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    cover_image_url: Optional[str] = Field(None, max_length=500)
    book_type: Optional[str] = Field(None, max_length=50)
    genres: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None
    is_public: Optional[bool] = None


class BookFrontMatterUpdate(BaseModel):
    """Schema for updating book front matter."""

    dedication: Optional[str] = None
    acknowledgments: Optional[str] = None
    preface: Optional[str] = None
    introduction: Optional[str] = None


class BookBackMatterUpdate(BaseModel):
    """Schema for updating book back matter."""

    epilogue: Optional[str] = None
    afterword: Optional[str] = None
    about_author: Optional[str] = None


class BookChapterAdd(BaseModel):
    """Schema for adding chapters to a book."""

    chapter_ids: List[UUID]


class BookChapterReorder(BaseModel):
    """Schema for reordering chapters within a book."""

    chapter_ids: List[UUID]  # Chapters in desired order


class BookExportRequest(BaseModel):
    """Request to export a book."""

    format: str = Field(..., pattern="^(pdf|epub|docx|html|markdown)$")
    include_front_matter: bool = True
    include_back_matter: bool = True
    include_toc: bool = True
    page_size: Optional[str] = "letter"  # letter, a4, a5
    font_size: Optional[int] = 12
    font_family: Optional[str] = "serif"


# ============== Response Schemas ==============


class BookChapterResponse(BaseModel):
    """Chapter within a book context."""

    chapter_id: UUID
    order_index: int
    part_number: Optional[int] = None
    part_title: Optional[str] = None
    chapter: ChapterListResponse


class BookResponse(BaseSchema, IDMixin, TimestampMixin):
    """Full book response."""

    title: str
    subtitle: Optional[str] = None
    author_name: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    book_type: Optional[str] = None
    genres: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    status: str
    is_public: bool
    word_count: int
    chapter_count: int
    last_exported_at: Optional[datetime] = None
    last_export_format: Optional[str] = None


class BookDetailResponse(BookResponse):
    """Book response with chapters and front/back matter."""

    dedication: Optional[str] = None
    acknowledgments: Optional[str] = None
    preface: Optional[str] = None
    introduction: Optional[str] = None
    epilogue: Optional[str] = None
    afterword: Optional[str] = None
    about_author: Optional[str] = None
    chapters: List[BookChapterResponse] = []


class BookListResponse(BaseSchema, IDMixin):
    """Simplified book response for lists."""

    title: str
    subtitle: Optional[str] = None
    author_name: Optional[str] = None
    book_type: Optional[str] = None
    status: str
    word_count: int
    chapter_count: int
    created_at: datetime


class BookExportResponse(BaseModel):
    """Response for book export."""

    id: UUID
    format: str
    download_url: str
    file_size: int
    expires_at: datetime
    message: str
