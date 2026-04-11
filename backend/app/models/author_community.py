"""Author community and networking models."""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Boolean, JSON, Text, Float, Table
from sqlalchemy.orm import relationship
from app.db import Base
import enum


class AuthorProfile(Base):
    """Author's public profile and portfolio."""
    
    __tablename__ = "author_profiles"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # Profile info
    bio = Column(Text, nullable=True)
    website = Column(String(500), nullable=True)
    social_links = Column(JSON, default={})  # {"twitter": "...", "instagram": "..."}
    
    # Public settings
    visibility = Column(String(50), default="public")  # public, private
    allow_beta_requests = Column(Integer, default=1)
    allow_messages = Column(Integer, default=1)
    allow_collaboration_requests = Column(Integer, default=1)
    
    # Stats
    published_books_count = Column(Integer, default=0)
    total_readers = Column(Integer, default=0)
    average_rating = Column(Float, default=0.0)
    
    # Badges/achievement
    verified = Column(Integer, default=0)
    featured = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class BetaReaderProfile(Base):
    """Beta reader profile and preferences."""
    
    __tablename__ = "beta_reader_profiles"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # Beta reader info
    is_beta_reader = Column(Integer, default=0)
    experience_level = Column(String(50))  # beginner, intermediate, expert
    
    # Interests (genres)
    preferred_genres = Column(JSON, default=[])  # ["sci-fi", "romance", ...]
    max_word_count = Column(Integer, default=100000)
    
    # Capacity
    current_requests = Column(Integer, default=0)
    max_concurrent_books = Column(Integer, default=3)
    
    # Response time
    avg_response_days = Column(Integer, default=14)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class BetaReaderMatch(Base):
    """Beta reader matching and feedback tracking."""
    
    __tablename__ = "beta_reader_matches"
    
    id = Column(String(36), primary_key=True, index=True)
    book_id = Column(String(36), ForeignKey("books.id"), nullable=False, index=True)
    author_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    beta_reader_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Status
    status = Column(String(50), default="proposed")  # proposed, accepted, reading, completed, declined
    
    # Matching score
    compatibility_score = Column(Float, default=0.0)
    
    # Feedback
    feedback = Column(Text, nullable=True)
    overall_rating = Column(Integer, nullable=True)  # 1-5
    
    # Timeline
    proposed_at = Column(DateTime, default=datetime.utcnow)
    accepted_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])
    author = relationship("User", foreign_keys=[author_id])
    beta_reader = relationship("User", foreign_keys=[beta_reader_id])


class WritingGroup(Base):
    """Writing group/community."""
    
    __tablename__ = "writing_groups"
    
    id = Column(String(36), primary_key=True, index=True)
    creator_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Group info
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    slug = Column(String(100), unique=True, index=True)
    
    # Settings
    visibility = Column(String(50), default="public")  # public, private, invite-only
    member_count = Column(Integer, default=1)
    
    # Moderation
    requires_approval = Column(Integer, default=0)
    
    # Focus
    focus_genres = Column(JSON, default=[])  # ["sci-fi", "romance", ...]
    writing_stage = Column(JSON, default=[])  # ["drafting", "editing", "publishing"]
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("User", foreign_keys=[creator_id])


class WritingGroupMember(Base):
    """Writing group membership."""
    
    __tablename__ = "writing_group_members"
    
    id = Column(String(36), primary_key=True, index=True)
    group_id = Column(String(36), ForeignKey("writing_groups.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Role
    role = Column(String(50), default="member")  # creator, moderator, member
    
    # Status
    status = Column(String(50), default="active")  # active, suspended, left
    
    # Contribution
    post_count = Column(Integer, default=0)
    
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime, nullable=True)
    
    # Relationships
    group = relationship("WritingGroup")
    user = relationship("User", foreign_keys=[user_id])


class AuthorMessage(Base):
    """Direct messages between authors."""
    
    __tablename__ = "author_messages"
    
    id = Column(String(36), primary_key=True, index=True)
    sender_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Message
    subject = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)
    
    # Status
    is_read = Column(Integer, default=0)
    is_archived = Column(Integer, default=0)
    
    # Conversation
    reply_to_id = Column(String(36), ForeignKey("author_messages.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    read_at = Column(DateTime, nullable=True)
    
    # Relationships
    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])


class PublicAuthorPage(Base):
    """Public author landing page."""
    
    __tablename__ = "public_author_pages"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # Page content
    headline = Column(String(255), nullable=True)
    featured_bio = Column(Text, nullable=True)
    profile_image_url = Column(String(500), nullable=True)
    
    # Featured works
    featured_books = Column(JSON, default=[])  # [{"book_id": "...", "order": 0}, ...]
    
    # Customization
    theme_color = Column(String(20), default="#000000")
    banner_url = Column(String(500), nullable=True)
    
    # Analytics
    page_views = Column(Integer, default=0)
    click_throughs = Column(Integer, default=0)
    
    # Status
    is_published = Column(Integer, default=1)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class AuthorCollaboration(Base):
    """Collaboration request between authors."""
    
    __tablename__ = "author_collaborations"
    
    id = Column(String(36), primary_key=True, index=True)
    initiator_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    collaborator_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    book_id = Column(String(36), ForeignKey("books.id"), nullable=True)
    
    # Details
    type = Column(String(50))  # co-author, editor, illustrator, etc.
    message = Column(Text, nullable=True)
    
    # Status
    status = Column(String(50), default="proposed")  # proposed, accepted, rejected, completed
    
    # Dates
    proposed_at = Column(DateTime, default=datetime.utcnow)
    accepted_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    initiator = relationship("User", foreign_keys=[initiator_id])
    collaborator = relationship("User", foreign_keys=[collaborator_id])
    book = relationship("Book", foreign_keys=[book_id])
