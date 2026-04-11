"""
Review Link Schemas for Beta Reader Sharing

Allows authors to generate sharable review links for read-only chapter access
and feedback collection from beta readers.
"""

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import uuid


class ReviewLinkCreate(BaseModel):
    """Create a review link."""
    book_id: str
    chapter_ids: Optional[List[str]] = None  # If None, include all chapters
    expires_in_days: Optional[int] = 30  # Link expires after this many days
    allow_comments: bool = True  # Whether beta readers can leave comments
    reviewer_name: Optional[str] = None  # Optional: review session name/label
    password: Optional[str] = None  # Optional: require password to access


class ReviewLinkResponse(BaseModel):
    """Response containing a review link."""
    link_id: str
    book_id: str
    review_url: str  # Full URL to share with beta readers
    share_code: str  # Unique code in URL
    chapters_included: int
    expires_at: datetime
    created_at: datetime
    status: str  # "active", "expired", "disabled"
    viewer_count: int
    comment_count: int
    allow_comments: bool


class ReviewerFeedback(BaseModel):
    """Feedback left by a beta reader."""
    chapter_id: str
    chapter_title: str
    position: int  # Character position in chapter
    context_text: str  # 50-100 words around the comment
    feedback_text: str
    feedback_type: str  # "general", "suggestion", "issue", "praise"
    created_at: datetime
    reviewer_name: Optional[str] = None


class ReviewFeedbackCollectionResponse(BaseModel):
    """Collection of all feedback from a review link/session."""
    link_id: str
    book_id: str
    reviewer_count: int
    total_comments: int
    feedback_by_chapter: dict  # {chapter_id: [ReviewerFeedback]}
    feedback_by_type: dict  # {type: count}
    common_issues: List[str]  # Most frequently mentioned topics
    created_at: datetime
    exported_at: Optional[datetime] = None
