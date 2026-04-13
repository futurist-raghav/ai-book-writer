from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from enum import Enum
from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean, Integer, Float, Enum as SQLEnum, Table, JSON, Column
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from uuid import uuid4

from app.core.db import Base


# Association table for template favorites
template_favorites = Table(
    "template_favorites", Base.metadata,
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")),
    Column("template_id", UUID(as_uuid=True), ForeignKey("marketplace_templates.id", ondelete="CASCADE")),
)


class MarketplaceTemplate(Base):
    """
    Community-shared template available on the marketplace.
    Templates contributed by users for discovery and reuse.
    """
    __tablename__ = "marketplace_templates"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Creator info
    creator_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    creator = relationship("User", foreign_keys=[creator_id], viewonly=True)
    
    # Template info
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True) # novel, screenplay, academic, guide, etc.
    subcategory: Mapped[Optional[str]] = Column(String(100), nullable=True)  # e.g., "fantasy", "sci-fi" for novels
    
    # Template content
    chapter_structure: Mapped[Optional[dict]] = Column(Text, nullable=True)  # JSON: chapters, structure
    initial_metadata: Mapped[Optional[dict]] = Column(Text, nullable=True)  # JSON: default fields
    formatting_preset: Mapped[Optional[str]] = Column(String(100), nullable=True)  # Theme preset reference
    matter_config: Mapped[Optional[dict]] = Column(Text, nullable=True)  # JSON: front/back matter
    sample_content: Mapped[Optional[str]] = Column(Text, nullable=True)  # Preview text
    
    # Tags and discovery
    tags: Mapped[list[str]] = Column(ARRAY(String), default=list)  # ["fantasy", "novel", "beginner-friendly"]
    
    # Visibility and status
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, index=True) # Admin-promoted
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False) # Verified by moderators
    
    # Stats
    usage_count: Mapped[int] = mapped_column(Integer, default=0) # Times template was used
    rating_sum: Mapped[float] = mapped_column(Float, default=0) # Sum of all ratings
    rating_count: Mapped[int] = mapped_column(Integer, default=0) # Number of ratings
    
    # Relationships
    reviews: Mapped[list["TemplateReview"]] = relationship(
        "TemplateReview",
        back_populates="template",
        cascade="all, delete-orphan",
        lazy="select"
    )
    favorites: Mapped[list["User"]] = relationship(
        "User",
        secondary=template_favorites,
        lazy="select"
    )
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    @property
    def average_rating(self) -> float:
        """Calculate average rating"""
        if self.rating_count == 0:
            return 0.0
        return round(self.rating_sum / self.rating_count, 2)


class TemplateReview(Base):
    """
    User review of a marketplace template.
    Includes 1-5 star rating and optional text review.
    """
    __tablename__ = "template_reviews"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Foreign keys
    template_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("marketplace_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Relationships
    template = relationship("MarketplaceTemplate", back_populates="reviews")
    reviewer = relationship("User", foreign_keys=[reviewer_id], viewonly=True)
    
    # Review content
    rating: Mapped[int] = mapped_column(Integer, nullable=False) # 1-5 stars
    title: Mapped[Optional[str]] = Column(String(255), nullable=True)
    content: Mapped[Optional[str]] = Column(Text, nullable=True)
    
    # Metadata
    helpful_count: Mapped[int] = mapped_column(Integer, default=0) # Upvotes
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class TemplateCategory(Base):
    """
    Category metadata for template organization and discovery.
    Pre-defined categories to organize marketplace templates.
    """
    __tablename__ = "template_categories"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Category info
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = Column(Text, nullable=True)
    icon: Mapped[Optional[str]] = Column(String(50), nullable=True)  # Emoji or icon name
    
    # Display order
    order: Mapped[int] = mapped_column(Integer, default=0)
    
    # Stats
    template_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
