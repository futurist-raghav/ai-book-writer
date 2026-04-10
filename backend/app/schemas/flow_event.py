"""
Flow Engine Schemas

Pydantic models for flow events, dependencies, and timeline queries.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class FlowEventTypeEnum(str, Enum):
    """Flow event types."""
    SCENE = "scene"
    BEAT = "beat"
    MILESTONE = "milestone"
    ACT = "act"
    CHAPTER = "chapter"
    SUBPLOT = "subplot"
    BRANCH = "branch"
    CUSTOM = "custom"


class FlowEventStatusEnum(str, Enum):
    """Flow event status."""
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"


class FlowDependencyTypeEnum(str, Enum):
    """Dependency relationship types."""
    BLOCKS = "blocks"
    TRIGGERS = "triggers"
    FOLLOWS = "follows"
    REQUIRED_BEFORE = "required_before"


# Request Schemas
class FlowEventCreate(BaseModel):
    """Create a new flow event."""
    title: str = Field(..., min_length=1, max_length=255, description="Event title")
    description: Optional[str] = Field(None, max_length=2000, description="Event description")
    event_type: FlowEventTypeEnum = Field(FlowEventTypeEnum.BEAT, description="Event type")
    timeline_position: int = Field(default=0, ge=0, description="Timeline position for sorting")
    duration: Optional[int] = Field(None, ge=1, description="Duration in days/hours/minutes")
    status: FlowEventStatusEnum = Field(FlowEventStatusEnum.PLANNED, description="Event status")
    order_index: int = Field(default=0, ge=0, description="Display order index")
    metadata: Optional[dict] = Field(None, description="Custom metadata")


class FlowEventUpdate(BaseModel):
    """Update a flow event."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    event_type: Optional[FlowEventTypeEnum] = None
    timeline_position: Optional[int] = Field(None, ge=0)
    duration: Optional[int] = Field(None, ge=1)
    status: Optional[FlowEventStatusEnum] = None
    order_index: Optional[int] = Field(None, ge=0)
    metadata: Optional[dict] = None


class FlowDependencyCreate(BaseModel):
    """Create a dependency between flow events."""
    to_event_id: UUID = Field(..., description="Target event ID")
    dependency_type: FlowDependencyTypeEnum = Field(FlowDependencyTypeEnum.BLOCKS, description="Dependency type")
    metadata: Optional[dict] = Field(None, description="Custom metadata")


class FlowDependencyUpdate(BaseModel):
    """Update a dependency."""
    dependency_type: Optional[FlowDependencyTypeEnum] = None
    metadata: Optional[dict] = None


class FlowChapterEventLink(BaseModel):
    """Link a chapter to a flow event."""
    chapter_id: UUID = Field(..., description="Chapter ID")
    order_index: int = Field(default=0, ge=0, description="Display order")


# Response Schemas
class FlowDependencyResponse(BaseModel):
    """Dependency response."""
    id: UUID
    from_event_id: UUID
    to_event_id: UUID
    dependency_type: FlowDependencyTypeEnum
    metadata: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FlowEventResponse(BaseModel):
    """Flow event response with dependencies."""
    id: UUID
    book_id: UUID
    title: str
    description: Optional[str] = None
    event_type: FlowEventTypeEnum
    timeline_position: int
    duration: Optional[int] = None
    status: FlowEventStatusEnum
    order_index: int
    metadata: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FlowEventDetailResponse(FlowEventResponse):
    """Flow event with complete dependency information."""
    dependencies_from: List[FlowDependencyResponse] = Field(default_factory=list, description="Events this one blocks/triggers")
    dependencies_to: List[FlowDependencyResponse] = Field(default_factory=list, description="Events that block/trigger this one")
    chapter_associations: List[dict] = Field(default_factory=list, description="Associated chapters")


class TimelineEventResponse(BaseModel):
    """Event response for timeline visualization."""
    id: UUID
    title: str
    event_type: FlowEventTypeEnum
    status: FlowEventStatusEnum
    timeline_position: int
    duration: Optional[int] = None
    has_dependencies: bool = Field(default=False)
    blocked_by_count: int = Field(default=0)
    blocks_count: int = Field(default=0)

    class Config:
        from_attributes = True


class TimelineResponse(BaseModel):
    """Timeline view response."""
    book_id: UUID
    events: List[TimelineEventResponse] = Field(default_factory=list)
    total_events: int = 0
    
    class Config:
        from_attributes = True


class DependencyGraphNode(BaseModel):
    """Node in dependency graph."""
    id: UUID
    title: str
    event_type: FlowEventTypeEnum
    status: FlowEventStatusEnum
    dependencies: List[UUID] = Field(default_factory=list)


class DependencyGraphResponse(BaseModel):
    """Dependency graph response."""
    book_id: UUID
    nodes: List[DependencyGraphNode] = Field(default_factory=list)
    has_cycles: bool = False
    
    class Config:
        from_attributes = True
