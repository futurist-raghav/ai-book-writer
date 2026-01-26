"""
User Model

Stores user account information and preferences.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.audio import AudioFile
    from app.models.book import Book
    from app.models.chapter import Chapter
    from app.models.event import Event


class User(Base):
    """User account model."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Account status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)

    # Writing profile
    writing_style: Mapped[Optional[str]] = mapped_column(
        String(50),
        default="narrative",
        nullable=True,
    )  # narrative, journal, memoir, fiction
    preferred_tense: Mapped[Optional[str]] = mapped_column(
        String(20),
        default="past",
        nullable=True,
    )  # past, present
    preferred_perspective: Mapped[Optional[str]] = mapped_column(
        String(20),
        default="first",
        nullable=True,
    )  # first, third

    # Writing preferences stored as JSON
    writing_preferences: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        default=dict,
        nullable=True,
    )

    # API key preferences (for users who want to use their own keys)
    custom_api_keys: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        default=dict,
        nullable=True,
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
    last_login: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    audio_files: Mapped[List["AudioFile"]] = relationship(
        "AudioFile",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    events: Mapped[List["Event"]] = relationship(
        "Event",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    chapters: Mapped[List["Chapter"]] = relationship(
        "Chapter",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    books: Mapped[List["Book"]] = relationship(
        "Book",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User {self.email}>"
