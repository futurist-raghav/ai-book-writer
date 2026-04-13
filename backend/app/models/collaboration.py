"""
Collaboration Models

Stores team members, comments, and activity for collaborative writing.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func, Float, Integer, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.book import Book
    from app.models.user import User


class CollaboratorRole(str, Enum):
    """Role of a collaborator in a book project."""

    OWNER = "owner"
    EDITOR = "editor"
    REVIEWER = "reviewer"
    CONTRIBUTOR = "contributor"
    VIEWER = "viewer"


class Collaborator(Base):
    """Collaborator model - team members on a book project."""

    __tablename__ = "collaborators"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Book and User relationships
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

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user_id],
    )

    # Role and permissions
    role: Mapped[str] = mapped_column(
        String(50),
        default=CollaboratorRole.CONTRIBUTOR.value,
        nullable=False,
    )

    # Invitation
    is_accepted: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)

    # Timestamps
    invited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    accepted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<Collaborator {self.user_id} ({self.role})>"


class BookComment(Base):
    """Book comment model - comments on book and sections."""

    __tablename__ = "book_comments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Book and Author
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

    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    author: Mapped["User"] = relationship(
        "User",
        foreign_keys=[author_id],
    )

    # Comment content
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Target (can be on book, chapter, or section)
    target_type: Mapped[str] = mapped_column(
        String(50),
        default="book",
        nullable=False,
    )  # 'book', 'chapter', 'section'
    target_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Status
    is_resolved: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<BookComment {self.id} on {self.target_type}>"


class ActivityType(str, Enum):
    """Type of activity in a book project."""

    COMMENT_ADDED = "comment_added"
    COMMENT_RESOLVED = "comment_resolved"
    CHAPTER_CREATED = "chapter_created"
    CHAPTER_UPDATED = "chapter_updated"
    CHAPTER_DELETED = "chapter_deleted"
    COLLABORATOR_ADDED = "collaborator_added"
    COLLABORATOR_REMOVED = "collaborator_removed"
    BOOK_UPDATED = "book_updated"
    EXPORT_CREATED = "export_created"


class Activity(Base):
    """Activity log model - tracks all changes to a book."""

    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Book and Actor
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

    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor: Mapped["User"] = relationship(
        "User",
        foreign_keys=[actor_id],
    )

    # Activity details
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Related entity
    entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    def __repr__(self) -> str:
        return f"<Activity {self.activity_type} at {self.created_at}>"
