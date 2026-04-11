"""Pydantic schemas for author community."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class AuthorProfileResponse(BaseModel):
    """Author profile response."""
    id: str
    user_id: str
    bio: Optional[str]
    website: Optional[str]
    social_links: dict
    visibility: str
    published_books_count: int
    total_readers: int
    average_rating: float
    verified: bool
    featured: bool
    
    class Config:
        from_attributes = True


class BetaReaderProfileCreate(BaseModel):
    """Create beta reader profile."""
    experience_level: str = "beginner"
    preferred_genres: List[str] = []
    max_word_count: int = 100000
    max_concurrent_books: int = 3


class BetaReaderProfileResponse(BaseModel):
    """Beta reader profile response."""
    id: str
    user_id: str
    is_beta_reader: bool
    experience_level: str
    preferred_genres: List[str]
    max_word_count: int
    current_requests: int
    max_concurrent_books: int
    avg_response_days: int
    
    class Config:
        from_attributes = True


class BetaReaderMatchCreate(BaseModel):
    """Request beta reader match."""
    book_id: str
    beta_reader_id: str


class BetaReaderMatchResponse(BaseModel):
    """Beta reader match response."""
    id: str
    book_id: str
    beta_reader_id: str
    status: str
    compatibility_score: float
    feedback: Optional[str]
    overall_rating: Optional[int]
    proposed_at: datetime
    accepted_at: Optional[datetime]
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class WritingGroupCreate(BaseModel):
    """Create writing group."""
    name: str
    description: Optional[str] = None
    visibility: str = "public"
    focus_genres: List[str] = []
    writing_stage: List[str] = []


class WritingGroupResponse(BaseModel):
    """Writing group response."""
    id: str
    creator_id: str
    name: str
    description: Optional[str]
    slug: str
    visibility: str
    member_count: int
    focus_genres: List[str]
    writing_stage: List[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class AuthorMessageCreate(BaseModel):
    """Send message to another author."""
    recipient_id: str
    subject: Optional[str] = None
    content: str


class AuthorMessageResponse(BaseModel):
    """Author message response."""
    id: str
    sender_id: str
    recipient_id: str
    subject: Optional[str]
    content: str
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class PublicAuthorPageResponse(BaseModel):
    """Public author page response."""
    id: str
    user_id: str
    headline: Optional[str]
    featured_bio: Optional[str]
    profile_image_url: Optional[str]
    featured_books: List[dict]
    page_views: int
    click_throughs: int
    is_published: bool
    
    class Config:
        from_attributes = True


class AuthorCollaborationCreate(BaseModel):
    """Request collaboration with author."""
    collaborator_id: str
    type: str
    book_id: Optional[str] = None
    message: Optional[str] = None


class AuthorCollaborationResponse(BaseModel):
    """Author collaboration response."""
    id: str
    initiator_id: str
    collaborator_id: str
    type: str
    status: str
    proposed_at: datetime
    accepted_at: Optional[datetime]
    
    class Config:
        from_attributes = True
