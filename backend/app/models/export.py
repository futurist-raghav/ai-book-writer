"""
Export Model

Stores publishing and export information for books.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.book import Book
    from app.models.user import User


class ExportFormat(str, Enum):
    """Export format types."""

    PDF = "pdf"
    EPUB = "epub"
    DOCX = "docx"
    MARKDOWN = "markdown"
    LATEX = "latex"
    FOUNTAIN = "fountain"
    HTML = "html"
    JSON = "json"


class ExportStatus(str, Enum):
    """Status of an export job."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Export(Base):
    """Export/Publishing model."""

    __tablename__ = "exports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Book relationship
    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    book: Mapped["Book"] = relationship(
        "Book",
        foreign_keys=[book_id],
    )

    # User who initiated
    initiated_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    initiator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[initiated_by],
    )

    # Format and options
    format: Mapped[str] = mapped_column(String(50), nullable=False)
    export_options: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )
    # export_options can contain:
    # - include_frontmatter: bool
    # - include_backmatter: bool
    # - include_toc: bool
    # - page_size: str (a4, letter, etc)
    # - font_size: int
    # - line_spacing: float
    # - column_count: int
    # - metadata: dict with ISBN, publisher, imprint, etc

    # Status and result
    status: Mapped[str] = mapped_column(
        String(20),
        default=ExportStatus.PENDING.value,
        nullable=False,
        index=True,
    )
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Metadata
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<Export {self.format} ({self.status})>"
