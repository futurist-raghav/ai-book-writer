"""
Flow Engine Schemas

Pydantic models for flow event request/response handling.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.flow_engine import FlowEventType, FlowEventStatus, FlowDependencyType


class FlowEventCreateRequest(BaseModel):
    """Request model for creating a flow event."""

    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    event_type: str = Field(default=FlowEventType.BEAT.value)
    timeline_position: int = Field(default=0, ge=0)
    duration: Optional[int] = None
    status: str = Field(default=FlowEventStatus.PLANNED.value)
    metadata: Optional[dict] = Field(default_factory=dict)

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Meeting in the Forest",
                "description": "First encounter between hero and guide",
                "event_type": "scene",
                "timeline_position": 150,
                "duration": 30,
                "status": "planned",
                "metadata": {
                    "pov_character": "protagonist",
                    "location": "Whispering Woods",
                },
            }
        }


class FlowEventUpdateRequest(BaseModel):
    """Request model for updating a flow event."""

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    event_type: Optional[str] = None
    timeline_position: Optional[int] = Field(None, ge=0)
    duration: Optional[int] = None
    status: Optional[str] = None
    metadata: Optional[dict] = None

    class Config:
        json_schema_extra = {
            "example": {
                "status": "completed",
                "timeline_position": 160,
                "metadata": {
                    "completion_date": "2026-04-10",
                },
            }
        }


class FlowEventResponse(BaseModel):
    """Response model for a flow event."""

    id: UUID
    book_id: UUID
    title: str
    description: Optional[str]
    event_type: str
    timeline_position: int
    duration: Optional[int]
    status: str
    order_index: int
    metadata: Optional[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "book_id": "667e8400-e29b-41d4-a716-446655440000",
                "title": "Meeting in the Forest",
                "description": "First encounter between hero and guide",
                "event_type": "scene",
                "timeline_position": 150,
                "duration": 30,
                "status": "planned",
                "order_index": 5,
                "metadata": {
                    "pov_character": "protagonist",
                    "location": "Whispering Woods",
                },
                "created_at": "2026-04-10T10:00:00Z",
                "updated_at": "2026-04-10T10:00:00Z",
            }
        }


class FlowDependencyCreateRequest(BaseModel):
    """Request model for creating an event dependency."""

    to_event_id: UUID = Field(..., description="The dependent event")
    dependency_type: str = Field(default=FlowDependencyType.BLOCKS.value)
    metadata: Optional[dict] = Field(default_factory=dict)

    class Config:
        json_schema_extra = {
            "example": {
                "to_event_id": "550e8400-e29b-41d4-a716-446655440001",
                "dependency_type": "blocks",
                "metadata": {
                    "reason": "Hero must meet guide before entering forest",
                },
            }
        }


class FlowDependencyResponse(BaseModel):
    """Response model for an event dependency."""

    id: UUID
    from_event_id: UUID
    to_event_id: UUID
    dependency_type: str
    metadata: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


class FlowEventDetailResponse(FlowEventResponse):
    """Flow event with related dependencies and chapters."""

    dependencies_from: list[FlowDependencyResponse] = Field(default_factory=list)
    dependencies_to: list[FlowDependencyResponse] = Field(default_factory=list)
    chapter_count: int = Field(default=0)

    class Config:
        from_attributes = True


class FlowEventListResponse(BaseModel):
    """Response for paginated flow event list."""

    events: list[FlowEventResponse]
    total_count: int
    page: int
    limit: int
    has_more: bool

    class Config:
        json_schema_extra = {
            "example": {
                "events": [
                    {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "book_id": "667e8400-e29b-41d4-a716-446655440000",
                        "title": "Act I Opening",
                        "description": "Establishing the world",
                        "event_type": "act",
                        "timeline_position": 0,
                        "duration": None,
                        "status": "planned",
                        "order_index": 1,
                        "metadata": {},
                        "created_at": "2026-04-10T10:00:00Z",
                        "updated_at": "2026-04-10T10:00:00Z",
                    }
                ],
                "total_count": 15,
                "page": 1,
                "limit": 10,
                "has_more": True,
            }
        }


class FlowTimelineEventResponse(BaseModel):
    """Event in timeline view (Gantt-style)."""

    id: UUID
    title: str
    event_type: str
    timeline_position: int
    duration: Optional[int]
    status: str
    order_index: int
    chapter_count: int
    parent_event_ids: list[UUID] = Field(default_factory=list)  # Events that must complete first
    blocking_event_ids: list[UUID] = Field(default_factory=list)  # Events blocked by this one

    class Config:
        from_attributes = True


class FlowTimelineResponse(BaseModel):
    """Response for timeline query with chronological events."""

    book_id: UUID
    total_events: int
    timeline_range: dict = Field(
        default={"start_position": 0, "end_position": 1000},
        description="Min/max timeline positions"
    )
    events: list[FlowTimelineEventResponse]

    class Config:
        json_schema_extra = {
            "example": {
                "book_id": "667e8400-e29b-41d4-a716-446655440000",
                "total_events": 15,
                "timeline_range": {
                    "start_position": 0,
                    "end_position": 500,
                },
                "events": [
                    {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "title": "Act I Opening",
                        "event_type": "act",
                        "timeline_position": 0,
                        "duration": None,
                        "status": "planned",
                        "order_index": 1,
                        "chapter_count": 3,
                        "parent_event_ids": [],
                        "blocking_event_ids": ["550e8400-e29b-41d4-a716-446655440001"],
                    }
                ],
            }
        }


class FlowChapterEventRequest(BaseModel):
    """Request to link a chapter to an event."""

    chapter_id: UUID
    order_index: int = Field(default=0, ge=0)

    class Config:
        json_schema_extra = {
            "example": {
                "chapter_id": "770e8400-e29b-41d4-a716-446655440000",
                "order_index": 2,
            }
        }


class FlowChapterEventResponse(BaseModel):
    """Response for chapter-event association."""

    chapter_id: UUID
    event_id: UUID
    order_index: int
    created_at: datetime

    class Config:
        from_attributes = True
