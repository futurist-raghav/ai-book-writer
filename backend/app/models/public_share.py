"""
Public sharing and feedback for books.
"""

from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Text, JSON, Boolean, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db import Base
from datetime import datetime
import uuid


class PublicShare(Base):
    """Public share link for a book with feedback collection."""
    
    __tablename__ = "public_shares"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id = Column(String, ForeignKey("books.id"), nullable=False)
    
    # Share settings
    share_token = Column(String, unique=True, nullable=False, index=True)  # URL token
    is_active: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    allow_comments: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    allow_ratings: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    password = Column(String, nullable=True)  # Optional password protection
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True) # Optional expiration
    
    # Tracking
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    unique_viewers: Mapped[int] = mapped_column(Integer, default=0)
    
    # Relationships
    book = relationship("Book", backref="public_shares")
    feedback_responses = relationship("BookFeedback", back_populates="share")
    
    def __repr__(self):
        return f"<PublicShare {self.id} for book {self.book_id}>"


class BookFeedback(Base):
    """Feedback from public share readers."""
    
    __tablename__ = "book_feedback"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    share_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public_shares.id"), nullable=False)
    
    # Reader info (anonymous by default)
    reader_name = Column(String, nullable=True)
    reader_email = Column(String, nullable=True)
    
    # Feedback
    rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True) # 0-5 stars
    title = Column(String, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Tags/categories
    feedback_type = Column(String, nullable=True)  # "suggestion", "bug", "general", etc.
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Response tracking
    author_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    author_responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    share = relationship("PublicShare", back_populates="feedback_responses")
    
    def __repr__(self):
        return f"<BookFeedback {self.id}>"


class BookRating(Base):
    """Aggregated ratings for books on public shares."""
    
    __tablename__ = "book_ratings"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id = Column(String, ForeignKey("books.id"), nullable=False, unique=True)
    
    # Rating aggregates
    total_ratings: Mapped[int] = mapped_column(Integer, default=0)
    average_rating: Mapped[float] = mapped_column(Float, default=0.0)
    rating_1_count: Mapped[int] = mapped_column(Integer, default=0)
    rating_2_count: Mapped[int] = mapped_column(Integer, default=0)
    rating_3_count: Mapped[int] = mapped_column(Integer, default=0)
    rating_4_count: Mapped[int] = mapped_column(Integer, default=0)
    rating_5_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Metadata
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<BookRating {self.book_id}: {self.average_rating}/5>"
