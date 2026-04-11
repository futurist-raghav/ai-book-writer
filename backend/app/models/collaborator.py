"""
Collaborator Permissions & Roles Model

Stores collaborator relationships with role-based access control.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
import uuid

from sqlalchemy import Column, String, UUID, DateTime, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.core.database import Base


class CollaboratorRole(str, Enum):
    """Role-based access control for collaborators."""
    owner = "owner"          # Full access, can manage all
    editor = "editor"        # Can edit chapters, accept suggestions
    contributor = "contributor"  # Can add chapters and suggestions
    reviewer = "reviewer"    # Read-only, can comment/suggest
    viewer = "viewer"        # Read-only access


class Collaborator(Base):
    """
    Represents a user's collaboration on a book with specific role and permissions.
    """
    
    __tablename__ = "collaborators"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    book_id = Column(UUID, ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False)
    
    # Role determines permissions
    role = Column(SQLEnum(CollaboratorRole), default=CollaboratorRole.contributor)
    
    # Section-level permissions (optional)
    # If None, can access all chapters
    # If set, only these chapter IDs
    section_ids = Column(String(1000), nullable=True)  # Comma-separated chapter IDs
    
    # Status tracking
    status = Column(String(50), default="active")  # active, invited, rejected, removed
    invited_at = Column(DateTime, nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    removed_at = Column(DateTime, nullable=True)
    
    # When was this collaboration created
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    book = relationship("Book", foreign_keys=[book_id])
    user = relationship("User", foreign_keys=[user_id])
    
    def __repr__(self):
        return f"<Collaborator({self.user_id}, {self.role}, {self.status})>"
    
    def has_permission(self, permission: str) -> bool:
        """Check if collaborator has specific permission."""
        # Permission matrix by role
        permissions = {
            CollaboratorRole.owner: [
                "read", "edit", "delete", "invite", "manage_roles", 
                "accept_suggestions", "publish", "manage_collaborators"
            ],
            CollaboratorRole.editor: [
                "read", "edit", "accept_suggestions", "comment"
            ],
            CollaboratorRole.contributor: [
                "read", "edit", "comment", "suggest"
            ],
            CollaboratorRole.reviewer: [
                "read", "comment", "suggest"
            ],
            CollaboratorRole.viewer: [
                "read"
            ],
        }
        
        return permission in permissions.get(self.role, [])
    
    def can_edit_chapter(self, chapter_id: str) -> bool:
        """Check if collaborator can edit specific chapter."""
        # Owners and editors can edit any chapter
        if self.role in [CollaboratorRole.owner, CollaboratorRole.editor]:
            return True
        
        # Check section-level permissions
        if self.section_ids:
            allowed_sections = self.section_ids.split(",")
            return chapter_id in allowed_sections
        
        # Contributors can edit if no section restrictions
        if self.role == CollaboratorRole.contributor and not self.section_ids:
            return True
        
        return False
