"""
Schemas for public sharing and feedback.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


class BookFeedbackCreate(BaseModel):
    """Create feedback on a public share."""
    reader_name: Optional[str] = None
    reader_email: Optional[EmailStr] = None
    rating: Optional[float] = Field(None, ge=0, le=5)
    title: Optional[str] = None
    content: str
    feedback_type: Optional[str] = None


class BookFeedbackResponse(BaseModel):
    """Response with feedback details."""
    id: str
    reader_name: Optional[str]
    reader_email: Optional[str]
    rating: Optional[float]
    title: Optional[str]
    content: str
    feedback_type: Optional[str]
    created_at: datetime
    author_response: Optional[str] = None
    author_responded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PublicShareCreate(BaseModel):
    """Create a public share link."""
    allow_comments: bool = True
    allow_ratings: bool = True
    password: Optional[str] = None
    expires_at: Optional[datetime] = None


class PublicShareUpdate(BaseModel):
    """Update public share settings."""
    is_active: bool
    allow_comments: bool
    allow_ratings: bool
    password: Optional[str] = None
    expires_at: Optional[datetime] = None


class PublicShareResponse(BaseModel):
    """Public share details."""
    id: str
    share_token: str
    is_active: bool
    allow_comments: bool
    allow_ratings: bool
    created_at: datetime
    view_count: int
    unique_viewers: int
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BookRatingResponse(BaseModel):
    """Book rating aggregates."""
    book_id: str
    total_ratings: int
    average_rating: float
    rating_1_count: int
    rating_2_count: int
    rating_3_count: int
    rating_4_count: int
    rating_5_count: int
    updated_at: datetime

    class Config:
        from_attributes = True


class PublicShareDetailResponse(BaseModel):
    """Full public share with feedback."""
    share: PublicShareResponse
    feedback: List[BookFeedbackResponse]
    rating: Optional[BookRatingResponse] = None
