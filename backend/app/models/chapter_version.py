"""
Chapter Version Model

Stores snapshots of chapter content for version history and recovery.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.chapter import Chapter
    from app.models.user import User


class ChapterVersion(Base):
    """Chapter version model for tracking chapter history."""

    __tablename__ = "chapter_versions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Relationships
    chapter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chapters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Chapter content snapshot
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    subtitle: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    compiled_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    word_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Chapter metadata snapshot
    chapter_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    order_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    chapter_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    workflow_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Version metadata
    version_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # User-friendly name
    change_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # What changed
    is_auto_snapshot: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)  # Auto vs manual

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    chapter: Mapped["Chapter"] = relationship("Chapter", back_populates="versions")
    user: Mapped["User"] = relationship("User")
