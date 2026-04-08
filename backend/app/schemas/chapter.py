"""
Chapter Schemas

Request and response schemas for chapter-related endpoints.
"""

from datetime import datetime
from typing import Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import BaseSchema, IDMixin, TimestampMixin
from app.schemas.event import EventListResponse


# ============== Request Schemas ==============


class ChapterCreate(BaseModel):
    """Schema for creating a chapter."""

    title: str = Field(..., max_length=255)
    subtitle: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    summary: Optional[str] = None
    chapter_number: Optional[int] = None
    display_order: Optional[int] = Field(None, ge=0)
    chapter_type: Optional[str] = Field(None, max_length=50)
    workflow_status: Optional[str] = Field(None, max_length=20)
    word_count_target: Optional[int] = Field(None, ge=1)
    timeline_position: Optional[str] = Field(None, max_length=120)
    writing_style: Optional[str] = Field(None, max_length=50)
    tone: Optional[str] = Field(None, max_length=50)
    ai_enhancement_enabled: Optional[bool] = None
    event_ids: Optional[List[UUID]] = None  # Events to include


class ChapterUpdate(BaseModel):
    """Schema for updating a chapter."""

    title: Optional[str] = Field(None, max_length=255)
    subtitle: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    summary: Optional[str] = None
    chapter_number: Optional[int] = None
    display_order: Optional[int] = Field(None, ge=0)
    chapter_type: Optional[str] = Field(None, max_length=50)
    workflow_status: Optional[str] = Field(None, max_length=20)
    word_count_target: Optional[int] = Field(None, ge=1)
    timeline_position: Optional[str] = Field(None, max_length=120)
    writing_style: Optional[str] = Field(None, max_length=50)
    tone: Optional[str] = Field(None, max_length=50)
    ai_enhancement_enabled: Optional[bool] = None
    status: Optional[str] = None


class ChapterEventAdd(BaseModel):
    """Schema for adding events to a chapter."""

    event_ids: List[UUID]


class ChapterEventOrderItem(BaseModel):
    """Explicit reorder tuple for chapter event associations."""

    event_id: UUID
    order_index: int = Field(..., ge=0)


class ChapterEventReorder(BaseModel):
    """Schema for reordering events within a chapter."""

    event_ids: Optional[List[UUID]] = None  # Events in desired order
    event_orders: Optional[List[ChapterEventOrderItem]] = None

    @model_validator(mode="after")
    def validate_payload(self) -> "ChapterEventReorder":
        if not self.event_ids and not self.event_orders:
            raise ValueError("Either event_ids or event_orders must be provided")
        return self


class ChapterCompileRequest(BaseModel):
    """Request to compile chapter content."""

    regenerate: bool = False  # Force regeneration even if already compiled
    writing_style: Optional[str] = None  # Override user's default style
    tone: Optional[str] = None


class ChapterContextGenerateRequest(BaseModel):
    """Request to generate or regenerate chapter base context."""

    writing_form: Optional[str] = Field(
        None,
        description="Writing form such as memoir, novel, autobiography, business, essay",
    )
    force: bool = False


class ChapterContextUpdate(BaseModel):
    """Request to manually update chapter base context."""

    base_context: str = Field(..., min_length=30)
    writing_form: Optional[str] = None


class ChapterChatRequest(BaseModel):
    """Request for chapter workspace AI chat."""

    message: str = Field(..., min_length=3, max_length=8000)
    writing_form: Optional[str] = None
    rewrite_depth: Literal["light", "deep"] = "deep"
    include_current_compiled_content: bool = True
    preserve_writer_commitment: bool = True


# ============== Response Schemas ==============


class ChapterEventResponse(BaseModel):
    """Event within a chapter context."""

    event_id: UUID
    order_index: int
    custom_content: Optional[str] = None
    transition_text: Optional[str] = None
    event: EventListResponse


class ChapterAssetResponse(BaseModel):
    """Imported workspace asset metadata."""

    id: str
    asset_type: str
    filename: str
    path: str
    size_bytes: int
    created_at: str
    extracted_text_preview: Optional[str] = None


class ChapterProjectReference(BaseModel):
    """Project references linked to a chapter."""

    id: UUID
    title: str
    order_index: int


class ChapterResponse(BaseSchema, IDMixin, TimestampMixin):
    """Full chapter response."""

    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    summary: Optional[str] = None
    chapter_number: int
    order_index: int
    chapter_type: str
    workflow_status: str
    word_count_target: Optional[int] = None
    target_progress_percent: Optional[float] = None
    timeline_position: Optional[str] = None
    writing_style: Optional[str] = None
    tone: Optional[str] = None
    ai_enhancement_enabled: Optional[bool] = None
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
    summary: Optional[str] = None
    chapter_number: int
    chapter_type: str
    workflow_status: str
    word_count_target: Optional[int] = None
    target_progress_percent: Optional[float] = None
    timeline_position: Optional[str] = None
    ai_enhancement_enabled: Optional[bool] = None
    status: str
    word_count: int
    event_count: int
    projects: List[ChapterProjectReference] = []
    created_at: datetime


class ChapterCompileResponse(BaseModel):
    """Response for chapter compilation."""

    id: UUID
    compiled_content: str
    word_count: int
    compiled_at: datetime
    message: str


class ChapterContextResponse(BaseModel):
    """Response carrying chapter base context metadata."""

    chapter_id: UUID
    writing_form: str
    base_context: str
    generated_at: datetime
    message: str


class ChapterWorkspaceResponse(ChapterDetailResponse):
    """Chapter detail response enriched with workspace context."""

    writing_form: str
    base_context: str
    context_generated_at: Optional[datetime] = None
    chat_turns: int = 0
    recent_chat: List[Dict[str, str]] = []
    ai_enhancement_enabled: Optional[bool] = None
    effective_ai_enhancement_enabled: bool = True
    assets: List[ChapterAssetResponse] = []


class ChapterChatResponse(BaseModel):
    """Response for chapter AI chat turns."""

    chapter_id: UUID
    writing_form: str
    assistant_message: str
    rewritten_excerpt: Optional[str] = None
    metadata: Dict[str, int]
