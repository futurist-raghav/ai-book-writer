from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from enum import Enum
import uuid
from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean, Enum as SQLEnum, Float, Integer, JSON, Column
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class WorkspaceRole(str, Enum):
    """Workspace membership role levels"""
    ADMIN = "admin"  # Full control: settings, members, books
    EDITOR = "editor"  # Can create/edit books, manage content
    VIEWER = "viewer"  # Read-only access to books


class WorkspaceStatus(str, Enum):
    """Workspace lifecycle status"""
    ACTIVE = "active"
    ARCHIVED = "archived"
    SUSPENDED = "suspended"


class Workspace(Base):
    """
    Team workspace for organizing books and collaborators.
    
    A workspace is a container for multiple books and team members.
    Users create books within a workspace, and can share the workspace
    with team members at different permission levels.
    """
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Basic info
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = Column(Text, nullable=True)
    
    # Owner (creator) - user who created the workspace
    owner_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    owner = relationship("User", foreign_keys=[owner_id], viewonly=True)
    
    # Status
    status: Mapped[WorkspaceStatus] = mapped_column(SQLEnum(WorkspaceStatus), default=WorkspaceStatus.ACTIVE, index=True)
    
    # Settings
    default_role: Mapped[WorkspaceRole] = mapped_column(SQLEnum(WorkspaceRole), default=WorkspaceRole.VIEWER)
    is_default_workspace: Mapped[bool] = mapped_column(Boolean, default=False) # User's default workspace
    allow_public_sharing: Mapped[bool] = mapped_column(Boolean, default=True) # Allow public book links
    allow_member_invitations: Mapped[bool] = mapped_column(Boolean, default=True) # Non-admins can invite
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationships
    members: Mapped[list["WorkspaceMember"]] = relationship(
        "WorkspaceMember", 
        back_populates="workspace",
        cascade="all, delete-orphan",
        lazy="select"
    )
    
    books: Mapped[list["Book"]] = relationship(
        "Book",
        back_populates="workspace",
        cascade="all, delete-orphan",
        lazy="select"
    )
    
    style_guides: Mapped[list["StyleGuide"]] = relationship(
        "StyleGuide",
        back_populates="workspace",
        cascade="all, delete-orphan",
        lazy="select"
    )
    
    templates: Mapped[list["WorkspaceTemplate"]] = relationship(
        "WorkspaceTemplate",
        back_populates="workspace",
        cascade="all, delete-orphan",
        lazy="select"
    )


class WorkspaceMember(Base):
    """
    Team member in a workspace with specified role and permissions.
    """
    __tablename__ = "workspace_members"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Foreign keys
    workspace_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    invited_by_id: Mapped[Optional[str]] = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User", foreign_keys=[user_id], viewonly=True)
    invited_by = relationship("User", foreign_keys=[invited_by_id], viewonly=True)
    
    # Role and permissions
    role: Mapped[WorkspaceRole] = mapped_column(SQLEnum(WorkspaceRole), default=WorkspaceRole.VIEWER, index=True)
    
    # Metadata
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    invited_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True), nullable=True)
    is_pending: Mapped[bool] = mapped_column(Boolean, default=True) # Pending acceptance
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)  # Archived membership (soft delete)
    
    # Constraints
    __table_args__ = (
        # Unique constraint: one member per user per workspace
        # sqlalchemy will add this via alembic
    )


class StyleGuide(Base):
    """
    Shared style guide for a workspace.
    Contains writing conventions, terminology, brand voice guidelines.
    """
    __tablename__ = "style_guides"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Foreign keys
    workspace_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    workspace = relationship("Workspace", back_populates="style_guides")
    created_by = relationship("User", foreign_keys=[created_by_id], viewonly=True)
    
    # Content
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = Column(Text, nullable=True)
    
    # Style guide sections (stored as JSON in migration)
    terminology: Mapped[Optional[dict]] = Column(Text, nullable=True)  # JSON: {term: {preferred, alternatives, context}}
    voice_guidelines: Mapped[Optional[dict]] = Column(Text, nullable=True)  # JSON: {tone, perspective, audience}
    formatting_rules: Mapped[Optional[dict]] = Column(Text, nullable=True)  # JSON: {headings, lists, pagination}
    content_standards: Mapped[Optional[dict]] = Column(Text, nullable=True)  # JSON: {length, depth, references}
    
    # Metadata
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class WorkspaceTemplate(Base):
    """
    Workspace-level template for books.
    Can be shared with all members and applied to new books.
    """
    __tablename__ = "workspace_templates"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign keys
    workspace_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    workspace = relationship("Workspace", back_populates="templates")
    created_by = relationship("User", foreign_keys=[created_by_id], viewonly=True)
    
    # Template info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = Column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False) # novel, screenplay, academic, guide, etc.
    
    # Template structure
    chapter_structure: Mapped[Optional[dict]] = Column(Text, nullable=True)  # JSON: chapter count, names, structure
    initial_metadata: Mapped[Optional[dict]] = Column(Text, nullable=True)  # JSON: default metadata values
    formatting_preset: Mapped[Optional[str]] = Column(String(100), nullable=True)  # Reference to theme preset
    matter_config: Mapped[Optional[dict]] = Column(Text, nullable=True)  # JSON: front/back matter toggles
    
    # Stats
    usage_count: Mapped[int] = mapped_column(default=0) # Times applied
    is_public: Mapped[bool] = mapped_column(Boolean, default=False) # Shared with team
    is_default: Mapped[bool] = mapped_column(Boolean, default=False) # Default for new books
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
