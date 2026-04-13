"""Author community and networking models."""

from typing import TYPE_CHECKING, Optional

from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, Boolean, JSON, Text, Float, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base
import enum


class AuthorProfile(Base):
    """Author's public profile and portfolio."""
    
    __tablename__ = "author_profiles"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # Profile info
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    social_links: Mapped[Optional[dict]] = mapped_column(JSON, default={})  # {"twitter": "...", "instagram": "..."}
    
    # Public settings
    visibility: Mapped[str] = mapped_column(String(50), default="public")  # public, private
    allow_beta_requests: Mapped[int] = mapped_column(Integer, default=1)
    allow_messages: Mapped[int] = mapped_column(Integer, default=1)
    allow_collaboration_requests: Mapped[int] = mapped_column(Integer, default=1)
    
    # Stats
    published_books_count: Mapped[int] = mapped_column(Integer, default=0)
    total_readers: Mapped[int] = mapped_column(Integer, default=0)
    average_rating: Mapped[float] = mapped_column(Float, default=0.0)
    
    # Badges/achievement
    verified: Mapped[int] = mapped_column(Integer, default=0)
    featured: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class BetaReaderProfile(Base):
    """Beta reader profile and preferences."""
    
    __tablename__ = "beta_reader_profiles"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # Beta reader info
    is_beta_reader: Mapped[int] = mapped_column(Integer, default=0)
    experience_level: Mapped[Optional[str]] = mapped_column(String(50))  # beginner, intermediate, expert
    
    # Interests (genres)
    preferred_genres: Mapped[Optional[list]] = mapped_column(JSON, default=[])  # ["sci-fi", "romance", ...]
    max_word_count: Mapped[int] = mapped_column(Integer, default=100000)
    
    # Capacity
    current_requests: Mapped[int] = mapped_column(Integer, default=0)
    max_concurrent_books: Mapped[int] = mapped_column(Integer, default=3)
    
    # Response time
    avg_response_days: Mapped[int] = mapped_column(Integer, default=14)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class BetaReaderMatch(Base):
    """Beta reader matching and feedback tracking."""
    
    __tablename__ = "beta_reader_matches"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    book_id: Mapped[str] = mapped_column(String(36), ForeignKey("books.id"), nullable=False, index=True)
    author_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    beta_reader_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Status
    status: Mapped[str] = mapped_column(String(50), default="proposed")  # proposed, accepted, reading, completed, declined
    
    # Matching score
    compatibility_score: Mapped[float] = mapped_column(Float, default=0.0)
    
    # Feedback
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    overall_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-5
    
    # Timeline
    proposed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])
    author = relationship("User", foreign_keys=[author_id])
    beta_reader = relationship("User", foreign_keys=[beta_reader_id])


class WritingGroup(Base):
    """Writing group/community."""
    
    __tablename__ = "writing_groups"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    creator_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Group info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    
    # Settings
    visibility: Mapped[str] = mapped_column(String(50), default="public")  # public, private, invite-only
    member_count: Mapped[int] = mapped_column(Integer, default=1)
    
    # Moderation
    requires_approval: Mapped[int] = mapped_column(Integer, default=0)
    
    # Focus
    focus_genres: Mapped[Optional[list]] = mapped_column(JSON, default=[])  # ["sci-fi", "romance", ...]
    writing_stage: Mapped[Optional[list]] = mapped_column(JSON, default=[])  # ["drafting", "editing", "publishing"]
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("User", foreign_keys=[creator_id])


class WritingGroupMember(Base):
    """Writing group membership."""
    
    __tablename__ = "writing_group_members"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("writing_groups.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Role
    role: Mapped[str] = mapped_column(String(50), default="member")  # creator, moderator, member
    
    # Status
    status: Mapped[str] = mapped_column(String(50), default="active")  # active, suspended, left
    
    # Contribution
    post_count: Mapped[int] = mapped_column(Integer, default=0)
    
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    left_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    group = relationship("WritingGroup")
    user = relationship("User", foreign_keys=[user_id])


class AuthorMessage(Base):
    """Direct messages between authors."""
    
    __tablename__ = "author_messages"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    sender_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    recipient_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Message
    subject: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Status
    is_read: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[int] = mapped_column(Integer, default=0)
    
    # Conversation
    reply_to_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("author_messages.id"), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])


class PublicAuthorPage(Base):
    """Public author landing page."""
    
    __tablename__ = "public_author_pages"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # Page content
    headline: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    featured_bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profile_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Featured works
    featured_books: Mapped[Optional[list]] = mapped_column(JSON, default=[])  # [{"book_id": "...", "order": 0}, ...]
    
    # Customization
    theme_color: Mapped[str] = mapped_column(String(20), default="#000000")
    banner_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Analytics
    page_views: Mapped[int] = mapped_column(Integer, default=0)
    click_throughs: Mapped[int] = mapped_column(Integer, default=0)
    
    # Status
    is_published: Mapped[int] = mapped_column(Integer, default=1)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class AuthorCollaboration(Base):
    """Collaboration request between authors."""
    
    __tablename__ = "author_collaborations"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    initiator_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    collaborator_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    book_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("books.id"), nullable=True)
    
    # Details
    item_type: Mapped[Optional[str]] = mapped_column(String(50))  # co-author, editor, illustrator, etc.
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Status
    status: Mapped[str] = mapped_column(String(50), default="proposed")  # proposed, accepted, rejected, completed
    
    # Dates
    proposed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    initiator = relationship("User", foreign_keys=[initiator_id])
    collaborator = relationship("User", foreign_keys=[collaborator_id])
    book = relationship("Book", foreign_keys=[book_id])
