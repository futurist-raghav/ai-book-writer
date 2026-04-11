"""
Comments and Mentions Schemas

Allows users to comment on chapters, mention collaborators, and track comment threads.
"""

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import uuid


class CommentMention(BaseModel):
    """A mention of another user in a comment."""
    user_id: str
    username: str
    email: str


class CommentCreate(BaseModel):
    """Create a new comment on a chapter."""
    chapter_id: str
    content: str
    position: Optional[int] = None  # Character position if inline comment
    context_text: Optional[str] = None  # Surrounding text for inline comments
    mentioned_users: Optional[List[str]] = []  # List of user IDs to mention


class CommentResponse(BaseModel):
    """Comment response with full details."""
    id: str
    chapter_id: str
    author_id: str
    author_name: str
    author_avatar: Optional[str] = None
    content: str
    position: Optional[int] = None
    context_text: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_resolved: bool
    resolved_by: Optional[str] = None  # User ID who resolved
    resolved_at: Optional[datetime] = None
    mentions: List[CommentMention] = []
    reply_count: int
    likes: int


class CommentReplyCreate(BaseModel):
    """Reply to a comment."""
    content: str
    mentioned_users: Optional[List[str]] = []


class CommentReplyResponse(BaseModel):
    """Comment reply response."""
    id: str
    comment_id: str
    author_id: str
    author_name: str
    author_avatar: Optional[str] = None
    content: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    mentions: List[CommentMention] = []
    likes: int


class ChapterCommentsResponse(BaseModel):
    """All comments on a chapter."""
    chapter_id: str
    total_comments: int
    unresolved_count: int
    comments: List[CommentResponse]


class CommentNotification(BaseModel):
    """Notification for comment mentions or replies."""
    id: str
    user_id: str
    type: str  # "mention", "reply", "resolved"
    comment_id: str
    chapter_id: str
    trigger_user_id: str
    trigger_user_name: str
    message: str
    is_read: bool
    created_at: datetime
