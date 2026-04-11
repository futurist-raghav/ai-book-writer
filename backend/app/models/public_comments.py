"""Models for reader comments and ratings on public shares."""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Float, Text, Boolean
from sqlalchemy.orm import relationship
from app.db import Base


class PublicComment(Base):
    """Comment on a public share."""
    
    __tablename__ = "public_comments"
    
    id = Column(String(36), primary_key=True, index=True)
    public_share_id = Column(String(36), ForeignKey("public_shares.id"), nullable=False, index=True)
    reader_name = Column(String(255), nullable=True)  # Anonymous if null
    reader_email = Column(String(255), nullable=True)  # For follow-ups (anonymized in public)
    
    # Comment content
    content = Column(Text, nullable=False)
    comment_type = Column(String(50))  # 'general', 'grammar', 'structure', 'style', 'characters', etc.
    
    # Moderation
    is_approved = Column(Boolean, default=True)
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(String(255))
    
    # Engagement
    likes = Column(Integer, default=0)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    public_share = relationship("PublicShare", back_populates="comments")


class PublicRating(Base):
    """Rating on a public share."""
    
    __tablename__ = "public_ratings"
    
    id = Column(String(36), primary_key=True, index=True)
    public_share_id = Column(String(36), ForeignKey("public_shares.id"), nullable=False, index=True)
    reader_name = Column(String(255), nullable=True)
    reader_email = Column(String(255), nullable=True)
    
    # Rating
    rating = Column(Integer, nullable=False)  # 1-5
    title = Column(String(255))  # Optional review title
    review_text = Column(Text)  # Optional detailed review
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    public_share = relationship("PublicShare", back_populates="ratings")
