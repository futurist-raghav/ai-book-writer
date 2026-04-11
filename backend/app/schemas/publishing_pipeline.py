"""Pydantic schemas for publishing pipeline."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class PublishingProfileCreate(BaseModel):
    """Create publishing profile."""
    book_id: str
    isbn: Optional[str] = None
    publisher_name: Optional[str] = None
    edition: str = "1st Edition"
    publication_date: Optional[datetime] = None
    copyright_year: Optional[int] = None
    primary_channel: str = "direct"
    ebook_price_cents: Optional[int] = None
    paperback_price_cents: Optional[int] = None


class PublishingProfileResponse(BaseModel):
    """Publishing profile response."""
    id: str
    book_id: str
    isbn: Optional[str]
    publisher_name: Optional[str]
    edition: str
    publication_date: Optional[datetime]
    primary_channel: str
    status: str
    is_published: bool
    distribution_channels: List[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PublishingQueueCreate(BaseModel):
    """Queue book for publishing."""
    book_id: str
    channel: str  # amazon_kdp, ingramspark, etc.
    format_type: str  # pdf, epub, mobi, paperback
    scheduled_date: Optional[datetime] = None


class PublishingQueueResponse(BaseModel):
    """Publishing queue response."""
    id: str
    book_id: str
    channel: str
    format_type: str
    status: str
    queued_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]
    
    class Config:
        from_attributes = True


class PublishingMetricsResponse(BaseModel):
    """Publishing metrics response."""
    id: str
    book_id: str
    total_sales: int
    total_revenue_cents: int
    amazon_sales: int
    amazon_revenue_cents: int
    ingramspark_sales: int
    ingramspark_revenue_cents: int
    total_downloads: int
    average_rating: int  # 0-500 for 0.0-5.0
    review_count: int
    page_views: int
    last_sync_at: Optional[datetime]
    updated_at: datetime
    
    class Config:
        from_attributes = True


class IsbnRequestCreate(BaseModel):
    """Request ISBN."""
    book_id: str
    provider: str = "bowker"


class IsbnRequestResponse(BaseModel):
    """ISBN request response."""
    id: str
    book_id: str
    isbn_13: Optional[str]
    isbn_10: Optional[str]
    provider: str
    status: str
    requested_at: datetime
    assigned_at: Optional[datetime]
    cost_cents: int
    
    class Config:
        from_attributes = True
