"""
Transcription Schemas

Request and response schemas for transcription-related endpoints.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import BaseSchema, IDMixin, TimestampMixin


# ============== Nested Schemas ==============


class TranscriptionSegment(BaseModel):
    """A time-aligned segment of transcription."""

    start: float  # Start time in seconds
    end: float  # End time in seconds
    text: str
    confidence: Optional[float] = None


class TranscriptionWord(BaseModel):
    """A word-level timestamp."""

    start: float
    end: float
    word: str
    confidence: Optional[float] = None


# ============== Request Schemas ==============


class TranscriptionUpdate(BaseModel):
    """Schema for updating transcription text."""

    text: str
    segments: Optional[List[TranscriptionSegment]] = None


class TranscriptionRetryRequest(BaseModel):
    """Request to retry failed transcription."""

    audio_id: UUID
    force: bool = False  # Force retry even if already transcribed


class ManualTranscriptionCreate(BaseModel):
    """Create or replace transcription text manually for an audio file."""

    text: str = Field(..., min_length=1)
    language: Optional[str] = Field(None, max_length=10)


# ============== Response Schemas ==============


class TranscriptionResponse(BaseSchema, IDMixin, TimestampMixin):
    """Full transcription response."""

    text: str
    segments: Optional[List[TranscriptionSegment]] = None
    words: Optional[List[TranscriptionWord]] = None
    language: Optional[str] = None
    language_probability: Optional[float] = None
    stt_service: str
    stt_model: Optional[str] = None
    task_mode: str
    ai_enhanced: bool = False
    status: str
    error_message: Optional[str] = None
    processing_time: Optional[float] = None
    is_edited: bool = False
    word_count: int
    audio_file_id: UUID


class TranscriptionSummaryResponse(BaseSchema, IDMixin):
    """Simplified transcription response for lists."""

    text: str = Field(..., max_length=500)  # Truncated
    language: Optional[str] = None
    status: str
    word_count: int
    created_at: datetime
    audio_file_id: UUID

    @property
    def text_preview(self) -> str:
        """Return truncated text preview."""
        if len(self.text) > 200:
            return self.text[:200] + "..."
        return self.text


class TranscriptionStatusResponse(BaseModel):
    """Transcription processing status."""

    id: UUID
    audio_file_id: UUID
    status: str
    progress: Optional[float] = None
    message: Optional[str] = None
    error_message: Optional[str] = None
