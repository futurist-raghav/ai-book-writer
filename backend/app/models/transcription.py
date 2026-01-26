"""
Transcription Model

Stores transcribed text from audio files with timestamp segments.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.audio import AudioFile
    from app.models.event import Event


class TranscriptionStatus(str, Enum):
    """Transcription processing status."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class Transcription(Base):
    """Transcription model."""

    __tablename__ = "transcriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Full transcription text
    text: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Time-aligned segments
    # Format: [{"start": 0.0, "end": 2.5, "text": "Hello", "confidence": 0.95}, ...]
    segments: Mapped[Optional[list]] = mapped_column(
        JSONB,
        default=list,
        nullable=True,
    )

    # Word-level timestamps (optional, for precise audio sync)
    # Format: [{"start": 0.0, "end": 0.5, "word": "Hello", "confidence": 0.98}, ...]
    words: Mapped[Optional[list]] = mapped_column(
        JSONB,
        default=list,
        nullable=True,
    )

    # Language detection
    language: Mapped[Optional[str]] = mapped_column(
        String(10),
        nullable=True,
    )  # ISO 639-1 code
    language_probability: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )

    # STT service info
    stt_service: Mapped[str] = mapped_column(
        String(50),
        default="whisper",
        nullable=False,
    )  # whisper, google, etc.
    stt_model: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )  # whisper-1, etc.

    # Processing info
    status: Mapped[str] = mapped_column(
        String(20),
        default=TranscriptionStatus.PENDING.value,
        nullable=False,
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    processing_time: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )  # in seconds

    # User edits tracking
    is_edited: Mapped[bool] = mapped_column(default=False)
    edit_history: Mapped[Optional[list]] = mapped_column(
        JSONB,
        default=list,
        nullable=True,
    )

    # Audio file reference
    audio_file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("audio_files.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    audio_file: Mapped["AudioFile"] = relationship(
        "AudioFile",
        back_populates="transcription",
    )
    events: Mapped[List["Event"]] = relationship(
        "Event",
        back_populates="transcription",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Transcription {self.id}>"

    @property
    def word_count(self) -> int:
        """Return the word count of the transcription."""
        if not self.text:
            return 0
        return len(self.text.split())
