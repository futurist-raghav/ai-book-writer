"""
Event Schemas

Request and response schemas for event-related endpoints.
"""

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import BaseSchema, IDMixin, TimestampMixin


# ============== Nested Schemas ==============


class PersonMention(BaseModel):
    """A person mentioned in an event."""

    name: str
    relationship: Optional[str] = None  # father, friend, teacher, etc.
    description: Optional[str] = None


class LocationDetails(BaseModel):
    """Location details for an event."""

    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


# ============== Request Schemas ==============


class EventCreate(BaseModel):
    """Schema for creating an event manually."""

    title: str = Field(..., max_length=255)
    summary: Optional[str] = None
    content: str
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    tags: Optional[List[str]] = None
    event_date: Optional[date] = None
    event_date_precision: Optional[str] = None
    age_at_event: Optional[int] = None
    location: Optional[str] = Field(None, max_length=255)
    people: Optional[List[PersonMention]] = None
    sentiment: Optional[str] = None
    emotions: Optional[List[str]] = None


class EventUpdate(BaseModel):
    """Schema for updating an event."""

    title: Optional[str] = Field(None, max_length=255)
    summary: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    tags: Optional[List[str]] = None
    event_date: Optional[date] = None
    event_date_precision: Optional[str] = None
    age_at_event: Optional[int] = None
    location: Optional[str] = Field(None, max_length=255)
    location_details: Optional[LocationDetails] = None
    people: Optional[List[PersonMention]] = None
    sentiment: Optional[str] = None
    emotions: Optional[List[str]] = None
    status: Optional[str] = None
    is_featured: Optional[bool] = None


class EventReorderRequest(BaseModel):
    """Request to reorder events."""

    event_ids: List[UUID]  # Events in desired order


# ============== Response Schemas ==============


class EventResponse(BaseSchema, IDMixin, TimestampMixin):
    """Full event response."""

    title: str
    summary: Optional[str] = None
    content: str
    original_text: Optional[str] = None
    audio_start_time: Optional[float] = None
    audio_end_time: Optional[float] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    tags: Optional[List[str]] = None
    event_date: Optional[date] = None
    event_date_precision: Optional[str] = None
    age_at_event: Optional[int] = None
    location: Optional[str] = None
    location_details: Optional[LocationDetails] = None
    people: Optional[List[PersonMention]] = None
    sentiment: Optional[str] = None
    emotions: Optional[List[str]] = None
    extraction_confidence: Optional[float] = None
    status: str
    order_index: int
    is_featured: bool
    word_count: int
    transcription_id: Optional[UUID] = None


class EventListResponse(BaseSchema, IDMixin):
    """Simplified event response for lists."""

    title: str
    summary: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    event_date: Optional[date] = None
    status: str
    is_featured: bool
    word_count: int
    created_at: datetime


class EventExtractionResponse(BaseModel):
    """Response for event extraction from transcription."""

    transcription_id: UUID
    events_created: int
    events: List[EventListResponse]
    message: str
