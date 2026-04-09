"""
Collaboration Schemas

Request and response schemas for collaboration-related endpoints.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import BaseSchema, IDMixin, TimestampMixin


# ============== Request Schemas ==============


class CollaboratorInvite(BaseModel):
    """Schema for inviting a collaborator."""

    email: str = Field(..., description="Email of the user to invite")
    role: str = Field(default="contributor", description="Role for the collaborator")


class CollaboratorRoleUpdate(BaseModel):
    """Schema for updating a collaborator's role."""

    role: str = Field(..., description="New role for the collaborator")


class BookCommentCreate(BaseModel):
    """Schema for creating a comment."""

    content: str = Field(..., description="Comment content")
    target_type: str = Field(default="book", description="Type of target (book, chapter, section)")
    target_id: Optional[str] = Field(None, description="ID of the target entity")


class BookCommentUpdate(BaseModel):
    """Schema for updating a comment."""

    content: Optional[str] = None
    is_resolved: Optional[bool] = None


# ============== Response Schemas ==============


class CollaboratorResponse(BaseSchema, IDMixin, TimestampMixin):
    """Schema for collaborator response."""

    book_id: UUID
    user_id: UUID
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    role: str
    is_accepted: bool
    invited_at: datetime
    accepted_at: Optional[datetime] = None


class CollaboratorListResponse(BaseModel):
    """Schema for list of collaborators."""

    data: List[CollaboratorResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class BookCommentResponse(BaseSchema, IDMixin):
    """Schema for book comment response."""

    book_id: UUID
    author_id: Optional[UUID] = None
    author_name: Optional[str] = None
    content: str
    target_type: str
    target_id: Optional[str] = None
    is_resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None
    updated_at: datetime


class BookCommentListResponse(BaseModel):
    """Schema for list of comments."""

    data: List[BookCommentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ActivityResponse(BaseSchema, IDMixin):
    """Schema for activity response."""

    book_id: UUID
    actor_id: Optional[UUID] = None
    actor_name: Optional[str] = None
    activity_type: str
    title: str
    description: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    created_at: datetime


class ActivityListResponse(BaseModel):
    """Schema for list of activities."""

    data: List[ActivityResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class CollaborationSummaryResponse(BaseModel):
    """Schema for collaboration summary."""

    book_id: UUID
    collaborators_count: int
    pending_invitations: int
    active_collaborators: int
    unresolved_comments: int
    total_comments: int
    recent_activities: List[ActivityResponse]
