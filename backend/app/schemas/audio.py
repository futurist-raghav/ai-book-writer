"""
Audio Schemas

Request and response schemas for audio-related endpoints.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import BaseSchema, IDMixin, TimestampMixin


# ============== Request Schemas ==============


class AudioMetadata(BaseModel):
    """Metadata for audio upload."""

    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    recording_date: Optional[datetime] = None
    tags: Optional[List[str]] = None


class AudioUpdate(BaseModel):
    """Schema for updating audio file metadata."""

    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    recording_date: Optional[datetime] = None
    tags: Optional[List[str]] = None


# ============== Response Schemas ==============


class AudioResponse(BaseSchema, IDMixin, TimestampMixin):
    """Schema for audio file response."""

    filename: str
    original_filename: str
    file_size: int
    mime_type: str
    file_format: str
    duration: Optional[float] = None
    duration_formatted: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    recording_date: Optional[datetime] = None
    tags: Optional[List[str]] = None
    status: str
    error_message: Optional[str] = None
    processed_at: Optional[datetime] = None


class AudioListResponse(BaseSchema, IDMixin):
    """Simplified schema for audio list."""

    filename: str
    original_filename: str
    title: Optional[str] = None
    duration: Optional[float] = None
    duration_formatted: Optional[str] = None
    status: str
    tags: Optional[List[str]] = None
    created_at: datetime


class AudioUploadResponse(BaseModel):
    """Response for audio upload."""

    id: UUID
    filename: str
    status: str
    message: str = "Audio file uploaded successfully. Transcription will begin shortly."


class AudioStatusResponse(BaseModel):
    """Response for audio processing status."""

    id: UUID
    status: str
    progress: Optional[float] = None  # 0-100
    message: Optional[str] = None
    error_message: Optional[str] = None
