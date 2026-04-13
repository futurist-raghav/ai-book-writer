"""Models for reader comments and ratings on public shares."""

from typing import TYPE_CHECKING, Optional

from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, Float, Text, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base


class PublicComment(Base):
    """Comment on a public share."""
    
    __tablename__ = "public_comments"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    public_share_id: Mapped[str] = mapped_column(String(36), ForeignKey("public_shares.id"), nullable=False, index=True)
    reader_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True) # Anonymous if null
    reader_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # For follow-ups (anonymized in public)
    
    # Comment content
    content: Mapped[str] = mapped_column(Text, nullable=False)
    comment_type: Mapped[str] = mapped_column(String(50)) # 'general', 'grammar', 'structure', 'style', 'characters', etc.
    
    # Moderation
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_reason: Mapped[str] = mapped_column(String(255))
    
    # Engagement
    likes: Mapped[int] = mapped_column(Integer, default=0)
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    public_share = relationship("PublicShare", back_populates="comments")


class PublicRating(Base):
    """Rating on a public share."""
    
    __tablename__ = "public_ratings"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    public_share_id: Mapped[str] = mapped_column(String(36), ForeignKey("public_shares.id"), nullable=False, index=True)
    reader_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reader_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Rating
    rating: Mapped[int] = mapped_column(Integer, nullable=False) # 1-5
    title: Mapped[str] = mapped_column(String(255)) # Optional review title
    review_text: Mapped[str] = mapped_column(Text) # Optional detailed review
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    public_share = relationship("PublicShare", back_populates="ratings")
