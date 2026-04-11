"""Advanced publishing pipeline models."""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Boolean, JSON, Enum, Text
from sqlalchemy.orm import relationship
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
    
    id = Column(String(36), primary_key=True, index=True)
    book_id = Column(String(36), ForeignKey("books.id"), nullable=False, unique=True, index=True)
    
    # Basic info
    isbn = Column(String(20), nullable=True, unique=True)
    international_isbn = Column(String(20), nullable=True)
    
    # Publishing details
    publisher_name = Column(String(255), nullable=True)
    imprint = Column(String(255), nullable=True)
    edition = Column(String(50), default="1st Edition")
    
    # Metadata
    publication_date = Column(DateTime, nullable=True)
    copyright_year = Column(Integer, nullable=True)
    
    # Distribution
    primary_channel = Column(String(50), default="direct")
    distribution_channels = Column(JSON, default=[])  # ["amazon_kdp", "ingramspark"]
    
    # Pricing (stored as cents to avoid float issues)
    ebook_price_cents = Column(Integer, nullable=True)  # cents
    paperback_price_cents = Column(Integer, nullable=True)
    hardcover_price_cents = Column(Integer, nullable=True)
    
    # Settings
    status = Column(String(50), default="draft")  # draft, scheduled, published, unpublished
    is_published = Column(Integer, default=0)
    visibility = Column(String(50), default="private")  # private, unlisted, public
    
    # Indices
    book_index_enabled = Column(Integer, default=1)
    table_of_contents_enabled = Column(Integer, default=1)
    
    # DRM
    digital_rights_management = Column(Integer, default=0)
    allow_downloads = Column(Integer, default=1)
    
    # Metadata JSON
    metadata_settings = Column(JSON, default={})
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])


class PublishingQueue(Base):
    """Publishing schedule and queue."""
    
    __tablename__ = "publishing_queue"
    
    id = Column(String(36), primary_key=True, index=True)
    book_id = Column(String(36), ForeignKey("books.id"), nullable=False, index=True)
    
    # Queue details
    channel = Column(String(50), nullable=False)  # amazon_kdp, ingramspark, etc.
    format_type = Column(String(50), nullable=False)  # pdf, epub, mobi, paperback
    
    # Scheduling
    scheduled_date = Column(DateTime, nullable=True)
    queued_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Status
    status = Column(String(50), default="pending")  # pending, processing, completed, failed
    error_message = Column(Text, nullable=True)
    
    # Job tracking
    job_id = Column(String(200), nullable=True)
    retry_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])


class PublishingMetrics(Base):
    """Publishing analytics and metrics."""
    
    __tablename__ = "publishing_metrics"
    
    id = Column(String(36), primary_key=True, index=True)
    book_id = Column(String(36), ForeignKey("books.id"), nullable=False, unique=True, index=True)
    
    # Sales metrics
    total_sales = Column(Integer, default=0)
    total_revenue_cents = Column(Integer, default=0)  # in cents
    
    # Platform metrics
    amazon_sales = Column(Integer, default=0)
    amazon_revenue_cents = Column(Integer, default=0)
    ingramspark_sales = Column(Integer, default=0)
    ingramspark_revenue_cents = Column(Integer, default=0)
    
    # Download metrics
    total_downloads = Column(Integer, default=0)
    ebook_downloads = Column(Integer, default=0)
    
    # Engagement
    average_rating = Column(Integer, default=0)  # Out of 5, stored as int (0-500 for 0.0-5.0)
    review_count = Column(Integer, default=0)
    
    # Visibility
    page_views = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    
    # Last updated
    last_sync_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])


class IsbnRequest(Base):
    """ISBN allocation tracking."""
    
    __tablename__ = "isbn_requests"
    
    id = Column(String(36), primary_key=True, index=True)
    book_id = Column(String(36), ForeignKey("books.id"), nullable=False, index=True)
    
    # Request details
    isbn_10 = Column(String(20), nullable=True, unique=True)
    isbn_13 = Column(String(20), nullable=True, unique=True)
    
    # Provider
    provider = Column(String(50))  # bowker, thriftbooks, etc.
    
    # Status
    status = Column(String(50), default="pending")  # pending, assigned, activated, expired
    requested_at = Column(DateTime, default=datetime.utcnow)
    assigned_at = Column(DateTime, nullable=True)
    activated_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    
    # Cost
    cost_cents = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])
