"""
Chapter Version Schemas

Request and response schemas for chapter version endpoints.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import BaseSchema, IDMixin, TimestampMixin


# ============== Request Schemas ==============


class ChapterVersionCreate(BaseModel):
    """Schema for creating a chapter version snapshot."""

    version_name: Optional[str] = Field(None, max_length=255)
    change_description: Optional[str] = None
    is_auto_snapshot: bool = Field(default=True)


class ChapterVersionUpdate(BaseModel):
    """Schema for updating a chapter version."""

    version_name: Optional[str] = Field(None, max_length=255)
    change_description: Optional[str] = None


# ============== Response Schemas ==============


class ChapterVersionResponse(BaseSchema, IDMixin, TimestampMixin):
    """Full chapter version response."""

    chapter_id: UUID
    user_id: UUID
    title: Optional[str] = None
    subtitle: Optional[str] = None
    compiled_content: Optional[str] = None
    summary: Optional[str] = None
    word_count: Optional[int] = None
    chapter_number: Optional[int] = None
    order_index: Optional[int] = None
    chapter_type: Optional[str] = None
    workflow_status: Optional[str] = None
    version_name: Optional[str] = None
    change_description: Optional[str] = None
    is_auto_snapshot: bool


class ChapterVersionListResponse(BaseSchema, IDMixin, TimestampMixin):
    """Simplified chapter version for lists (no content)."""

    chapter_id: UUID
    user_id: UUID
    title: Optional[str] = None
    word_count: Optional[int] = None
    version_name: Optional[str] = None
    change_description: Optional[str] = None
    is_auto_snapshot: bool


class ChapterVersionDiffResponse(BaseModel):
    """Response for diff between two versions."""

    from_version_id: UUID
    to_version_id: UUID
    title_changed: bool
    summary_changed: bool
    content_diff: str  # Unified diff format
    word_count_before: Optional[int]
    word_count_after: Optional[int]
    word_count_change: int  # Positive = added, negative = removed
