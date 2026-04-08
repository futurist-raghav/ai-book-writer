"""
Book Schemas

Request and response schemas for book-related endpoints.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.chapter import ChapterListResponse
from app.schemas.common import BaseSchema, IDMixin, TimestampMixin


# ============== Request Schemas ==============


class BookCreate(BaseModel):
    """Schema for creating a book."""

    title: str = Field(..., max_length=255)
    subtitle: Optional[str] = Field(None, max_length=255)
    author_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    project_context: Optional[str] = None
    project_settings: Optional[dict] = None
    project_type: Optional[str] = Field(None, max_length=50)
    book_type: Optional[str] = Field(None, max_length=50)
    genre: Optional[str] = Field(None, max_length=100)
    genres: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    labels: Optional[List[str]] = None
    cover_image_url: Optional[str] = Field(None, max_length=500)
    cover_color: Optional[str] = Field(None, max_length=32)
    target_word_count: Optional[int] = Field(None, ge=1)
    deadline_at: Optional[datetime] = None
    is_pinned: Optional[bool] = False
    default_writing_form: Optional[str] = Field(None, max_length=50)
    default_chapter_tone: Optional[str] = Field(None, max_length=50)
    ai_enhancement_enabled: bool = True
    status: Optional[str] = Field(None, max_length=20)
    auto_create_chapters: int = Field(0, ge=0, le=50)
    chapter_ids: Optional[List[UUID]] = None  # Chapters to include


class BookUpdate(BaseModel):
    """Schema for updating a book."""

    title: Optional[str] = Field(None, max_length=255)
    subtitle: Optional[str] = Field(None, max_length=255)
    author_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    project_context: Optional[str] = None
    project_settings: Optional[dict] = None
    cover_image_url: Optional[str] = Field(None, max_length=500)
    cover_color: Optional[str] = Field(None, max_length=32)
    project_type: Optional[str] = Field(None, max_length=50)
    book_type: Optional[str] = Field(None, max_length=50)
    genre: Optional[str] = Field(None, max_length=100)
    genres: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    labels: Optional[List[str]] = None
    target_word_count: Optional[int] = Field(None, ge=1)
    deadline_at: Optional[datetime] = None
    is_pinned: Optional[bool] = None
    default_writing_form: Optional[str] = Field(None, max_length=50)
    default_chapter_tone: Optional[str] = Field(None, max_length=50)
    ai_enhancement_enabled: Optional[bool] = None
    status: Optional[str] = None
    is_public: Optional[bool] = None


class BookPinUpdate(BaseModel):
    """Schema for pin/unpin actions."""

    is_pinned: bool


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


class BookChapterOrderItem(BaseModel):
    """Explicit reorder tuple for chapter associations."""

    chapter_id: UUID
    order_index: int = Field(..., ge=0)


class BookChapterReorder(BaseModel):
    """Schema for reordering chapters within a book."""

    chapter_ids: Optional[List[UUID]] = None  # Chapters in desired order
    chapter_orders: Optional[List[BookChapterOrderItem]] = None

    @model_validator(mode="after")
    def validate_payload(self) -> "BookChapterReorder":
        if not self.chapter_ids and not self.chapter_orders:
            raise ValueError("Either chapter_ids or chapter_orders must be provided")
        return self


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
    project_context: Optional[str] = None
    project_settings: Optional[dict] = None
    cover_image_url: Optional[str] = None
    cover_color: Optional[str] = None
    project_type: Optional[str] = None
    book_type: Optional[str] = None
    genres: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    labels: Optional[List[str]] = None
    target_word_count: Optional[int] = None
    target_progress_percent: Optional[float] = None
    deadline_at: Optional[datetime] = None
    is_pinned: bool = False
    default_writing_form: Optional[str] = None
    default_chapter_tone: Optional[str] = None
    ai_enhancement_enabled: bool
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
    cover_image_url: Optional[str] = None
    cover_color: Optional[str] = None
    project_context: Optional[str] = None
    project_type: Optional[str] = None
    genres: Optional[List[str]] = None
    labels: Optional[List[str]] = None
    target_word_count: Optional[int] = None
    target_progress_percent: Optional[float] = None
    deadline_at: Optional[datetime] = None
    is_pinned: bool = False
    default_writing_form: Optional[str] = None
    default_chapter_tone: Optional[str] = None
    ai_enhancement_enabled: bool = True
    book_type: Optional[str] = None
    status: str
    word_count: int
    chapter_count: int
    created_at: datetime
    updated_at: datetime


class BookExportResponse(BaseModel):
    """Response for book export."""

    id: UUID
    format: str
    download_url: str
    file_size: int
    expires_at: datetime
    message: str
