"""
Collaborator Schemas

Request/response models for collaborator management and role management.
"""

from datetime import datetime
from typing import List, Optional
from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class CollaboratorRole(str, Enum):
    """Available collaborator roles."""
    owner = "owner"
    editor = "editor"
    contributor = "contributor"
    reviewer = "reviewer"
    viewer = "viewer"


class CollaboratorStatus(str, Enum):
    """Collaborator status."""
    active = "active"
    invited = "invited"
    rejected = "rejected"
    removed = "removed"


class CollaboratorInvite(BaseModel):
    """Invite a new collaborator."""
    email: EmailStr = Field(..., description="Email address to invite")
    role: CollaboratorRole = Field(default=CollaboratorRole.contributor, description="Role for invitee")
    section_ids: Optional[List[str]] = Field(
        None, 
        description="Limit access to specific chapters (None = all chapters)"
    )


class CollaboratorUpdate(BaseModel):
    """Update collaborator role and permissions."""
    role: Optional[CollaboratorRole] = Field(None, description="New role")
    section_ids: Optional[List[str]] = Field(None, description="Sections they can access")


class CollaboratorResponse(BaseModel):
    """Full collaborator detail."""
    id: str
    book_id: str
    user_id: str
    user_name: str
    user_email: str
    user_avatar: Optional[str]
    
    role: CollaboratorRole
    section_ids: Optional[List[str]]
    
    status: CollaboratorStatus
    invited_at: Optional[datetime]
    accepted_at: Optional[datetime]
    rejected_at: Optional[datetime]
    removed_at: Optional[datetime]
    
    created_at: datetime
    updated_at: datetime


class BookCollaboratorsResponse(BaseModel):
    """All collaborators for a book."""
    book_id: str
    total_collaborators: int
    collaborators: List[CollaboratorResponse] = []


class CollaboratorInviteResponse(BaseModel):
    """Response after inviting a collaborator."""
    id: str
    book_id: str
    email: str
    role: CollaboratorRole
    status: CollaboratorStatus
    created_at: datetime


class CollaboratorPermissionCheck(BaseModel):
    """Check if user has permission."""
    user_id: str
    book_id: str
    permission: str  # e.g., "edit", "delete", "invite"
    chapter_id: Optional[str] = None  # For chapter-specific permissions
    has_permission: bool
