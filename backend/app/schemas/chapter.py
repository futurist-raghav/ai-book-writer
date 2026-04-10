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
    pov_character: Optional[str] = Field(None, max_length=120)
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
    pov_character: Optional[str] = Field(None, max_length=120)
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


class ChapterExpandNotesRequest(BaseModel):
    """Request to expand chapter notes into prose."""

    notes: str = Field(..., min_length=3, max_length=12000)
    tone: Optional[str] = Field(None, max_length=50)
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
    pov_character: Optional[str] = None
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
    pov_character: Optional[str] = None
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


class ChapterSummaryResponse(BaseModel):
    """Response for AI-generated chapter summary."""

    chapter_id: UUID
    summary: str
    generated_at: datetime
    message: str


class ChapterOutlineResponse(BaseModel):
    """Response for AI-generated chapter outline."""

    chapter_id: UUID
    outline: str
    sections: List[str]
    generated_at: datetime
    message: str


class ChapterExpandNotesResponse(BaseModel):
    """Response for chapter notes expansion."""

    chapter_id: UUID
    expanded_text: str
    diff_preview: str
    generated_at: datetime
    message: str


class ConsistencyIssueReference(BaseModel):
    """Chapter reference for a detected consistency issue."""

    chapter_id: UUID
    chapter_title: str
    chapter_number: int
    chapter_order: int
    matched_text: Optional[str] = None
    excerpt: Optional[str] = None


class ConsistencyIssue(BaseModel):
    """Single consistency issue found across chapter material."""

    id: str
    issue_type: Literal[
        "character_name_variation",
        "character_appearance_inconsistency",
        "timeline_inconsistency",
        "location_name_variation",
        "terminology_inconsistency",
    ]
    severity: Literal["low", "medium", "high"] = "medium"
    title: str
    description: str
    canonical_value: Optional[str] = None
    variants: List[str] = []
    references: List[ConsistencyIssueReference] = []
    fix_suggestions: List[str] = []


class ChapterConsistencyResponse(BaseModel):
    """Response for chapter consistency analysis across related chapters."""

    chapter_id: UUID
    generated_at: datetime
    issue_count: int
    issues: List[ConsistencyIssue] = []
    message: str


class ExtractedEntityReference(BaseModel):
    """Chapter reference metadata for an extracted entity."""

    chapter_id: UUID
    chapter_title: str
    chapter_number: int
    chapter_order: int
    mentions: int = 1
    context_snippet: Optional[str] = None


class ExtractedEntity(BaseModel):
    """Entity discovered from chapter text."""

    id: str
    name: str
    entity_type: Literal["character", "location", "object"]
    frequency: int
    first_mention_chapter_id: UUID
    first_mention_chapter_title: str
    first_mention_chapter_number: int
    first_mention_chapter_order: int
    context_snippet: Optional[str] = None
    references: List[ExtractedEntityReference] = []
    db_entity_id: Optional[UUID] = None  # UUID if entity was persisted to Entities table


class ChapterEntityExtractionResponse(BaseModel):
    """Response for chapter-driven entity extraction."""

    chapter_id: UUID
    generated_at: datetime
    entity_count: int
    entities: List[ExtractedEntity] = []
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
