"""Enterprise features: team management, SSO, audit logs, advanced permissions."""

from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, Enum as SQLEnum, JSON, ARRAY, Float, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum
from app.db import Base


class UserRole(str, enum.Enum):
    """User roles within a workspace/team."""
    ADMIN = "admin"
    MANAGER = "manager"
    EDITOR = "editor"
    VIEWER = "viewer"
    CUSTOM = "custom"


class SSOProvider(str, enum.Enum):
    """Supported SSO providers."""
    OKTA = "okta"
    AZURE_AD = "azure_ad"
    GOOGLE = "google"
    SAML = "saml"


class AuditEventType(str, enum.Enum):
    """Types of auditable events."""
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    USER_CREATE = "user_create"
    USER_UPDATE = "user_update"
    USER_DELETE = "user_delete"
    PERMISSION_CHANGE = "permission_change"
    BOOK_PUBLISH = "book_publish"
    BOOK_DELETE = "book_delete"
    CHAPTER_EDIT = "chapter_edit"
    COMMENT_DELETE = "comment_delete"
    INVITE_SENT = "invite_sent"
    TEAM_CREATE = "team_create"
    TEAM_UPDATE = "team_update"
    API_KEY_CREATE = "api_key_create"
    API_KEY_REVOKE = "api_key_revoke"
    EXPORT_INITIATED = "export_initiated"


class TeamMemberRole(str, enum.Enum):
    """Roles within a team."""
    OWNER = "owner"
    LEAD = "lead"
    MEMBER = "member"
    GUEST = "guest"


class PermissionLevel(str, enum.Enum):
    """Fine-grained permission levels."""
    NONE = "none"
    VIEW = "view"
    COMMENT = "comment"
    EDIT = "edit"
    DELETE = "delete"
    ADMIN = "admin"


# ===== TEAM MANAGEMENT =====

class Team(Base):
    """Organization/workspace team."""
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    slug: Mapped[str] = mapped_column(String(256), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Billing & limits
    max_members: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    max_books: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    max_api_keys: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    
    # Settings
    settings: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True) # { require_sso, sso_provider, allow_public_sharing, invite_domain }
    logo_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    website_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    
    # Metadata
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    sso_configs = relationship("SSOConfig", back_populates="team", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="team", cascade="all, delete-orphan")
    custom_roles = relationship("CustomRole", back_populates="team", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_teams_owner_id', 'owner_id'),
        Index('idx_teams_is_active', 'is_active'),
    )


class TeamMember(Base):
    """Team membership."""
    __tablename__ = "team_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Role & permissions
    role = Column(SQLEnum(TeamMemberRole), default=TeamMemberRole.MEMBER, nullable=False)
    custom_role_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("custom_roles.id", ondelete="SET NULL"), nullable=True)
    permissions: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True) # Override default role permissions
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    joined_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    invited_at: Mapped[Optional[datetime.time]] = mapped_column(DateTime(timezone=True), nullable=True)
    invited_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    accepted_at: Mapped[Optional[datetime.time]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    created_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    team = relationship("Team", back_populates="members")
    audit_logs = relationship("AuditLog", back_populates="team_member")
    
    __table_args__ = (
        Index('idx_team_members_user_id', 'user_id'),
        Index('idx_team_members_role', 'role'),
        Index('idx_team_members_is_active', 'is_active'),
    )


class CustomRole(Base):
    """Custom team role with fine-grained permissions."""
    __tablename__ = "custom_roles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Permissions as JSON object: { resource: [actions] }
    # Example: { "books": ["view", "edit"], "chapters": ["view"], "comments": ["view", "create", "delete"] }
    permissions: Mapped[dict] = mapped_column(JSON, nullable=False)
    
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    team = relationship("Team", back_populates="custom_roles")
    
    __table_args__ = (
        Index('idx_custom_roles_team_id', 'team_id'),
    )


# ===== SSO CONFIGURATION =====

class SSOConfig(Base):
    """SSO provider configuration per team."""
    __tablename__ = "sso_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    
    provider = Column(SQLEnum(SSOProvider), nullable=False)
    
    # Provider-specific config
    client_id: Mapped[str] = mapped_column(String(256), nullable=False)
    client_secret: Mapped[str] = mapped_column(String(512), nullable=False) # Encrypted in practice
    tenant_id: Mapped[Optional[str]] = mapped_column(String(256), nullable=True) # For Azure AD
    domain: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)  # Email domain to enforce (user@domain.com)
    
    # SAML-specific
    entity_id: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    sso_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    certificate: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Settings
    auto_provision: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False) # Auto-create users on first login
    require_mfa: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sync_groups: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False) # Sync LDAP/AD groups to team roles
    
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verified_at: Mapped[Optional[datetime.time]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    created_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    team = relationship("Team", back_populates="sso_configs")
    
    __table_args__ = (
        Index('idx_sso_configs_team_id', 'team_id'),
        Index('idx_sso_configs_provider', 'provider'),
    )


# ===== AUDIT LOGGING =====

class AuditLog(Base):
    """Immutable audit trail of all team events."""
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    team_member_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True, index=True)
    
    event_type = Column(SQLEnum(AuditEventType), nullable=False, index=True)
    actor_user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # What changed
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False) # "user", "book", "chapter", "comment"
    resource_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False) # "create", "update", "delete"
    
    # Changes
    old_values: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    new_values: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Context
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True) # IPv4 or IPv6
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="success", nullable=False) # "success", "failure"
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Metadata
    created_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    team = relationship("Team", back_populates="audit_logs")
    team_member = relationship("TeamMember", back_populates="audit_logs")
    
    __table_args__ = (
        Index('idx_audit_logs_team_id', 'team_id'),
        Index('idx_audit_logs_event_type', 'event_type'),
        Index('idx_audit_logs_created_at', 'created_at'),
        Index('idx_audit_logs_actor_user_id', 'actor_user_id'),
        Index('idx_audit_logs_resource_id', 'resource_id'),
    )


# ===== ADVANCED PERMISSIONS =====

class ResourcePermission(Base):
    """Fine-grained resource-level permissions."""
    __tablename__ = "resource_permissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    team_member_id: Mapped[str] = mapped_column(String(36), ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Resource
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False) # "book", "chapter", "workspace"
    resource_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    
    # Permission
    permission_level = Column(SQLEnum(PermissionLevel), nullable=False)
    
    # Conditions
    conditions: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True) # { time_limited: true, expires_at: "2025-03-01", ... }
    
    # Metadata
    granted_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    granted_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    __table_args__ = (
        Index('idx_resource_perms_team_id', 'team_id'),
        Index('idx_resource_perms_resource_id', 'resource_id'),
        Index('idx_resource_perms_team_member_id', 'team_member_id'),
    )


# ===== ANALYTICS & BILLING =====

class TeamActivityLog(Base):
    """Team-level activity summary (for analytics dashboards)."""
    __tablename__ = "team_activity_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Metrics for a day
    date: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    
    active_members: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_edits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_comments: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    books_created: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    chapters_created: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ai_calls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    created_at: Mapped[datetime.time] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    __table_args__ = (
        Index('idx_team_activity_logs_team_id', 'team_id'),
        Index('idx_team_activity_logs_date', 'date'),
    )
