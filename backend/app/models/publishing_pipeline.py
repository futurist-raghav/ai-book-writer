"""Advanced publishing pipeline models."""

from typing import TYPE_CHECKING, Optional

from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, Boolean, JSON, Enum, Text, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base
import enum


class PublishingStatus(str, enum.Enum):
    """Publishing status."""
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    UNPUBLISHED = "unpublished"
    ARCHIVED = "archived"


class DistributionChannel(str, enum.Enum):
    """Distribution channels."""
    AMAZON_KDP = "amazon_kdp"
    INGRAMSPARK = "ingramspark"
    DRAFT2DIGITAL = "draft2digital"
    SMASHWORDS = "smashwords"
    APPLE_BOOKS = "apple_books"
    GOOGLE_PLAY = "google_play"
    DIRECT = "direct"


class PublishingProfile(Base):
    """Book publishing configuration."""
    
    __tablename__ = "publishing_profiles"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    book_id: Mapped[str] = mapped_column(String(36), ForeignKey("books.id"), nullable=False, unique=True, index=True)
    
    # Basic info
    isbn: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, unique=True)
    international_isbn: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    
    # Publishing details
    publisher_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    imprint: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    edition: Mapped[str] = mapped_column(String(50), default="1st Edition")
    
    # Metadata
    publication_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    copyright_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Distribution
    primary_channel: Mapped[str] = mapped_column(String(50), default="direct")
    distribution_channels: Mapped[dict] = mapped_column(JSON, default=[]) # ["amazon_kdp", "ingramspark"]
    
    # Pricing (stored as cents to avoid float issues)
    ebook_price_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True) # cents
    paperback_price_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    hardcover_price_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Settings
    status: Mapped[str] = mapped_column(String(50), default="draft") # draft, scheduled, published, unpublished
    is_published: Mapped[int] = mapped_column(Integer, default=0)
    visibility: Mapped[str] = mapped_column(String(50), default="private") # private, unlisted, public
    
    # Indices
    book_index_enabled: Mapped[int] = mapped_column(Integer, default=1)
    table_of_contents_enabled: Mapped[int] = mapped_column(Integer, default=1)
    
    # DRM
    digital_rights_management: Mapped[int] = mapped_column(Integer, default=0)
    allow_downloads: Mapped[int] = mapped_column(Integer, default=1)
    
    # Metadata JSON
    metadata_settings: Mapped[dict] = mapped_column(JSON, default={})
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])


class PublishingQueue(Base):
    """Publishing schedule and queue."""
    
    __tablename__ = "publishing_queue"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    book_id: Mapped[str] = mapped_column(String(36), ForeignKey("books.id"), nullable=False, index=True)
    
    # Queue details
    channel: Mapped[str] = mapped_column(String(50), nullable=False) # amazon_kdp, ingramspark, etc.
    format_type: Mapped[str] = mapped_column(String(50), nullable=False) # pdf, epub, mobi, paperback
    
    # Scheduling
    scheduled_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    queued_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Status
    status: Mapped[str] = mapped_column(String(50), default="pending") # pending, processing, completed, failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Job tracking
    job_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])


class PublishingMetrics(Base):
    """Publishing analytics and metrics."""
    
    __tablename__ = "publishing_metrics"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    book_id: Mapped[str] = mapped_column(String(36), ForeignKey("books.id"), nullable=False, unique=True, index=True)
    
    # Sales metrics
    total_sales: Mapped[int] = mapped_column(Integer, default=0)
    total_revenue_cents: Mapped[int] = mapped_column(Integer, default=0) # in cents
    
    # Platform metrics
    amazon_sales: Mapped[int] = mapped_column(Integer, default=0)
    amazon_revenue_cents: Mapped[int] = mapped_column(Integer, default=0)
    ingramspark_sales: Mapped[int] = mapped_column(Integer, default=0)
    ingramspark_revenue_cents: Mapped[int] = mapped_column(Integer, default=0)
    
    # Download metrics
    total_downloads: Mapped[int] = mapped_column(Integer, default=0)
    ebook_downloads: Mapped[int] = mapped_column(Integer, default=0)
    
    # Engagement
    average_rating: Mapped[int] = mapped_column(Integer, default=0)  # Out of 5, stored as int (0-500 for 0.0-5.0)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Visibility
    page_views: Mapped[int] = mapped_column(Integer, default=0)
    shares: Mapped[int] = mapped_column(Integer, default=0)
    
    # Last updated
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])


class IsbnRequest(Base):
    """ISBN allocation tracking."""
    
    __tablename__ = "isbn_requests"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    book_id: Mapped[str] = mapped_column(String(36), ForeignKey("books.id"), nullable=False, index=True)
    
    # Request details
    isbn_10: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, unique=True)
    isbn_13: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, unique=True)
    
    # Provider
    provider: Mapped[str] = mapped_column(String(50)) # bowker, thriftbooks, etc.
    
    # Status
    status: Mapped[str] = mapped_column(String(50), default="pending") # pending, assigned, activated, expired
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    assigned_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Cost
    cost_cents: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])
