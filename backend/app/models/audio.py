"""
Audio File Model

Stores uploaded audio files and their metadata.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.transcription import Transcription
    from app.models.user import User


class AudioStatus(str, Enum):
    """Audio file processing status."""

    PENDING = "pending"
    UPLOADING = "uploading"
    UPLOADED = "uploaded"
    TRANSCRIBING = "transcribing"
    TRANSCRIBED = "transcribed"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"


class AudioFile(Base):
    """Audio file model."""

    __tablename__ = "audio_files"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # File information
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)  # in bytes
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_format: Mapped[str] = mapped_column(String(20), nullable=False)

    # Audio metadata
    duration: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )  # in seconds
    sample_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    channels: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bit_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # User-provided metadata
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recording_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    tags: Mapped[Optional[list]] = mapped_column(
        ARRAY(String),
        default=list,
        nullable=True,
    )

    # Processing status
    status: Mapped[str] = mapped_column(
        String(20),
        default=AudioStatus.PENDING.value,
        nullable=False,
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Additional metadata (language, speaker info, etc.)
    file_metadata: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        default=dict,
        nullable=True,
    )

    # Owner
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
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
    processed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="audio_files")
    transcription: Mapped[Optional["Transcription"]] = relationship(
        "Transcription",
        back_populates="audio_file",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<AudioFile {self.filename}>"

    @property
    def duration_formatted(self) -> str:
        """Return duration as formatted string (HH:MM:SS)."""
        if self.duration is None:
            return "00:00:00"
        hours, remainder = divmod(int(self.duration), 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
