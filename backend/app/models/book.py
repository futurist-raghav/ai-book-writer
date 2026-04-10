"""
Book Model

Stores complete books assembled from chapters.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.project_types import ProjectType

if TYPE_CHECKING:
    from app.models.chapter import Chapter
    from app.models.collaboration import Activity, BookComment, Collaborator
    from app.models.entity import Entity
    from app.models.export import Export
    from app.models.bibliography import Bibliography
    from app.models.reference import Reference
    from app.models.user import User


class BookStatus(str, Enum):
    """Book status."""

    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETED = "completed"
    PUBLISHED = "published"
    ARCHIVED = "archived"


PROJECT_TYPE_VALUES = tuple(project_type.value for project_type in ProjectType)
PROJECT_TYPE_ENUM = SAEnum(*PROJECT_TYPE_VALUES, name="project_type_enum")


class Book(Base):
    """Book model."""

    __tablename__ = "books"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Book metadata
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subtitle: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    author_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    project_context: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Cover and visuals
    cover_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    cover_color: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # Book type and genre
    project_type: Mapped[str] = mapped_column(
        PROJECT_TYPE_ENUM,
        nullable=False,
        default=ProjectType.NOVEL.value,
        server_default=ProjectType.NOVEL.value,
    )  # novel, screenplay, technical_manual, etc.
    project_metadata: Mapped[Optional[dict]] = mapped_column(
        "metadata",
        JSONB,
        default=dict,
        nullable=True,
    )  # Type-specific settings and configurations
    book_type: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )  # memoir, autobiography, biography, fiction
    genres: Mapped[Optional[list]] = mapped_column(
        ARRAY(String),
        default=list,
        nullable=True,
    )
    tags: Mapped[Optional[list]] = mapped_column(
        ARRAY(String),
        default=list,
        nullable=True,
    )
    labels: Mapped[Optional[list]] = mapped_column(
        JSONB,
        default=list,
        nullable=True,
    )
    target_word_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    deadline_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Front matter
    dedication: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    acknowledgments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    preface: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    introduction: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Back matter
    epilogue: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    afterword: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    about_author: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Status
    status: Mapped[str] = mapped_column(
        String(20),
        default=BookStatus.DRAFT.value,
        nullable=False,
    )
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)

    # Export settings
    export_settings: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        default=dict,
        nullable=True,
    )

    # Project-wide writing defaults
    project_settings: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        default=dict,
        nullable=True,
    )
    default_writing_form: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    default_chapter_tone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ai_enhancement_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Last export info
    last_exported_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_export_format: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

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

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="books")
    chapter_associations: Mapped[List["BookChapter"]] = relationship(
        "BookChapter",
        back_populates="book",
        cascade="all, delete-orphan",
        order_by="BookChapter.order_index",
    )
    entities: Mapped[List["Entity"]] = relationship(
        "Entity",
        foreign_keys="Entity.book_id",
        cascade="all, delete-orphan",
    )
    references: Mapped[List["Reference"]] = relationship(
        "Reference",
        back_populates="book",
        cascade="all, delete-orphan",
        foreign_keys="Reference.book_id",
    )
    collaborators: Mapped[List["Collaborator"]] = relationship(
        "Collaborator",
        foreign_keys="Collaborator.book_id",
        cascade="all, delete-orphan",
    )
    comments: Mapped[List["BookComment"]] = relationship(
        "BookComment",
        foreign_keys="BookComment.book_id",
        cascade="all, delete-orphan",
    )
    activities: Mapped[List["Activity"]] = relationship(
        "Activity",
        foreign_keys="Activity.book_id",
        cascade="all, delete-orphan",
    )
    exports: Mapped[List["Export"]] = relationship(
        "Export",
        foreign_keys="Export.book_id",
        cascade="all, delete-orphan",
    )
    bibliography_entries: Mapped[List["Bibliography"]] = relationship(
        "Bibliography",
        back_populates="book",
        cascade="all, delete-orphan",
        foreign_keys="Bibliography.book_id",
    )
    glossary_entries: Mapped[List["GlossaryEntry"]] = relationship(
        "GlossaryEntry",
        back_populates="book",
        cascade="all, delete-orphan",
        foreign_keys="GlossaryEntry.book_id",
    )

    def __repr__(self) -> str:
        return f"<Book {self.title}>"

    @property
    def chapters(self) -> List["Chapter"]:
        """Return list of chapters in this book."""
        return [assoc.chapter for assoc in self.chapter_associations]

    @property
    def word_count(self) -> int:
        """Return total word count of the book."""
        count = 0
        for chapter in self.chapters:
            count += chapter.word_count
        # Add front/back matter
        for text in [
            self.dedication,
            self.acknowledgments,
            self.preface,
            self.introduction,
            self.epilogue,
            self.afterword,
            self.about_author,
        ]:
            if text:
                count += len(text.split())
        return count

    @property
    def chapter_count(self) -> int:
        """Return number of chapters."""
        return len(self.chapter_associations)

    @property
    def target_progress_percent(self) -> Optional[float]:
        """Return completion progress against target word count."""
        if not self.target_word_count or self.target_word_count <= 0:
            return None
        progress = (self.word_count / self.target_word_count) * 100
        return round(min(progress, 100.0), 2)


class BookChapter(Base):
    """Association table for Book-Chapter many-to-many relationship."""

    __tablename__ = "book_chapters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False,
    )
    chapter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chapters.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Order within the book
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    # Part/section grouping (optional)
    part_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    part_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationships
    book: Mapped["Book"] = relationship("Book", back_populates="chapter_associations")
    chapter: Mapped["Chapter"] = relationship(
        "Chapter",
        back_populates="book_associations",
    )
