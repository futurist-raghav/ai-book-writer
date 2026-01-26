"""
Chapter Schemas

Request and response schemas for chapter-related endpoints.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import BaseSchema, IDMixin, TimestampMixin
from app.schemas.event import EventListResponse


# ============== Request Schemas ==============


class ChapterCreate(BaseModel):
    """Schema for creating a chapter."""

    title: str = Field(..., max_length=255)
    subtitle: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    chapter_number: Optional[int] = None
    writing_style: Optional[str] = Field(None, max_length=50)
    tone: Optional[str] = Field(None, max_length=50)
    event_ids: Optional[List[UUID]] = None  # Events to include


class ChapterUpdate(BaseModel):
    """Schema for updating a chapter."""

    title: Optional[str] = Field(None, max_length=255)
    subtitle: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    chapter_number: Optional[int] = None
    writing_style: Optional[str] = Field(None, max_length=50)
    tone: Optional[str] = Field(None, max_length=50)
    status: Optional[str] = None


class ChapterEventAdd(BaseModel):
    """Schema for adding events to a chapter."""

    event_ids: List[UUID]


class ChapterEventReorder(BaseModel):
    """Schema for reordering events within a chapter."""

    event_ids: List[UUID]  # Events in desired order


class ChapterCompileRequest(BaseModel):
    """Request to compile chapter content."""

    regenerate: bool = False  # Force regeneration even if already compiled
    writing_style: Optional[str] = None  # Override user's default style
    tone: Optional[str] = None


# ============== Response Schemas ==============


class ChapterEventResponse(BaseModel):
    """Event within a chapter context."""

    event_id: UUID
    order_index: int
    custom_content: Optional[str] = None
    transition_text: Optional[str] = None
    event: EventListResponse


class ChapterResponse(BaseSchema, IDMixin, TimestampMixin):
    """Full chapter response."""

    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    chapter_number: int
    order_index: int
    writing_style: Optional[str] = None
    tone: Optional[str] = None
    status: str
    compiled_content: Optional[str] = None
    last_compiled_at: Optional[datetime] = None
    word_count: int
    event_count: int


class ChapterDetailResponse(ChapterResponse):
    """Chapter response with events."""

    events: List[ChapterEventResponse] = []


class ChapterListResponse(BaseSchema, IDMixin):
    """Simplified chapter response for lists."""

    title: str
    subtitle: Optional[str] = None
    chapter_number: int
    status: str
    word_count: int
    event_count: int
    created_at: datetime


class ChapterCompileResponse(BaseModel):
    """Response for chapter compilation."""

    id: UUID
    compiled_content: str
    word_count: int
    compiled_at: datetime
    message: str
