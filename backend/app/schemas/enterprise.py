"""Enterprise feature validation schemas."""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ===== ENUMS =====

class UserRoleEnum(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    EDITOR = "editor"
    VIEWER = "viewer"
    CUSTOM = "custom"


class SSOProviderEnum(str, Enum):
    OKTA = "okta"
    AZURE_AD = "azure_ad"
    GOOGLE = "google"
    SAML = "saml"


class AuditEventTypeEnum(str, Enum):
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


class TeamMemberRoleEnum(str, Enum):
    OWNER = "owner"
    LEAD = "lead"
    MEMBER = "member"
    GUEST = "guest"


class PermissionLevelEnum(str, Enum):
    NONE = "none"
    VIEW = "view"
    COMMENT = "comment"
    EDIT = "edit"
    DELETE = "delete"
    ADMIN = "admin"


# ===== TEAM =====

class TeamCreate(BaseModel):
    """Create team."""
    name: str = Field(..., min_length=1, max_length=256)
    slug: str = Field(..., min_length=1, max_length=256, pattern="^[a-z0-9-]+$")
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website_url: Optional[str] = None


class TeamUpdate(BaseModel):
    """Update team."""
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website_url: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class TeamResponse(BaseModel):
    """Team response."""
    id: str
    name: str
    slug: str
    description: Optional[str]
    owner_id: str
    max_members: int
    max_books: int
    max_api_keys: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True


class TeamDetailResponse(TeamResponse):
    """Detailed team response with members."""
    members: List['TeamMemberResponse'] = []
    member_count: int = 0


# ===== TEAM MEMBERSHIP =====

class TeamMemberInvite(BaseModel):
    """Invite user to team."""
    email: EmailStr
    role: TeamMemberRoleEnum = TeamMemberRoleEnum.MEMBER


class TeamMemberUpdate(BaseModel):
    """Update team member role/permissions."""
    role: Optional[TeamMemberRoleEnum] = None
    permissions: Optional[Dict[str, Any]] = None
    custom_role_id: Optional[str] = None


class TeamMemberResponse(BaseModel):
    """Team member response."""
    id: str
    user_id: str
    role: str
    is_active: bool
    joined_at: datetime
    invited_at: Optional[datetime]
    accepted_at: Optional[datetime]
    
    class Config:
        orm_mode = True


# ===== CUSTOM ROLES =====

class CustomRoleCreate(BaseModel):
    """Create custom role."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    permissions: Dict[str, List[str]]  # { "books": ["view", "edit"], "chapters": ["view"] }


class CustomRoleUpdate(BaseModel):
    """Update custom role."""
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[Dict[str, List[str]]] = None


class CustomRoleResponse(BaseModel):
    """Custom role response."""
    id: str
    team_id: str
    name: str
    description: Optional[str]
    permissions: Dict[str, List[str]]
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True


# ===== SSO =====

class SSOConfigCreate(BaseModel):
    """Create SSO configuration."""
    provider: SSOProviderEnum
    client_id: str
    client_secret: str
    tenant_id: Optional[str] = None  # Azure AD
    domain: Optional[str] = None  # Email domain filter
    entity_id: Optional[str] = None  # SAML
    sso_url: Optional[str] = None  # SAML
    certificate: Optional[str] = None  # SAML
    auto_provision: bool = True
    require_mfa: bool = False
    sync_groups: bool = False


class SSOConfigUpdate(BaseModel):
    """Update SSO configuration."""
    client_secret: Optional[str] = None
    domain: Optional[str] = None
    auto_provision: Optional[bool] = None
    require_mfa: Optional[bool] = None
    sync_groups: Optional[bool] = None
    is_enabled: Optional[bool] = None


class SSOConfigResponse(BaseModel):
    """SSO configuration response (secrets redacted)."""
    id: str
    team_id: str
    provider: str
    domain: Optional[str]
    auto_provision: bool
    require_mfa: bool
    is_enabled: bool
    is_verified: bool
    verified_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True


# ===== AUDIT LOG =====

class AuditLogCreate(BaseModel):
    """Create audit log entry."""
    event_type: AuditEventTypeEnum
    resource_type: str
    resource_id: str
    action: str
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class AuditLogResponse(BaseModel):
    """Audit log response."""
    id: str
    team_id: str
    event_type: str
    actor_user_id: Optional[str]
    resource_type: str
    resource_id: str
    action: str
    old_values: Optional[Dict[str, Any]]
    new_values: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    status: str
    created_at: datetime
    
    class Config:
        orm_mode = True


class AuditLogFilterRequest(BaseModel):
    """Filter audit logs."""
    event_type: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    actor_user_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    limit: int = 100
    offset: int = 0


# ===== PERMISSIONS =====

class ResourcePermissionGrant(BaseModel):
    """Grant resource-level permission."""
    team_member_id: str
    resource_type: str
    resource_id: str
    permission_level: PermissionLevelEnum
    conditions: Optional[Dict[str, Any]] = None  # { time_limited: true, expires_at: "..." }


class ResourcePermissionResponse(BaseModel):
    """Resource permission response."""
    id: str
    team_id: str
    team_member_id: str
    resource_type: str
    resource_id: str
    permission_level: str
    granted_at: datetime
    
    class Config:
        orm_mode = True


# ===== ANALYTICS =====

class TeamActivityResponse(BaseModel):
    """Team activity summary."""
    date: datetime
    active_members: int
    total_edits: int
    total_comments: int
    books_created: int
    chapters_created: int
    ai_calls: int


class TeamStatsResponse(BaseModel):
    """Team statistics."""
    total_members: int
    active_members: int
    total_books: int
    total_chapters: int
    total_collaborators: int
    usage_percentage: float  # Based on subscription limits
    ai_calls_quota: int
    ai_calls_used: int
    recent_activity: List[TeamActivityResponse]


# ===== BULK OPERATIONS =====

class BulkPermissionRequest(BaseModel):
    """Bulk permission grant."""
    team_member_ids: List[str]
    resource_id: str
    resource_type: str
    permission_level: PermissionLevelEnum


class BulkUserCreate(BaseModel):
    """Bulk user creation."""
    users: List[TeamMemberInvite]
    role: TeamMemberRoleEnum = TeamMemberRoleEnum.MEMBER


# ===== SSO CALLBACKS =====

class SSOCallbackRequest(BaseModel):
    """SSO provider callback."""
    code: str
    state: str
    error: Optional[str] = None
    error_description: Optional[str] = None


class SSOTokenResponse(BaseModel):
    """SSO token exchange response."""
    access_token: str
    refresh_token: Optional[str]
    expires_in: int
    token_type: str = "Bearer"


# ===== MFA =====

class MFASetupRequest(BaseModel):
    """Setup MFA for team member."""
    method: str  # "totp", "sms", "email"
    phone_number: Optional[str] = None


class MFAVerifyRequest(BaseModel):
    """Verify MFA code."""
    code: str
    method: str


class MFABackupCodesResponse(BaseModel):
    """MFA backup codes."""
    codes: List[str]
    generated_at: datetime


# ===== EXPORT & COMPLIANCE =====

class ComplianceReportRequest(BaseModel):
    """Request compliance/audit report."""
    start_date: datetime
    end_date: datetime
    include_deleted: bool = False
    format: str = "pdf"  # "pdf", "csv", "json"


class DataExportRequest(BaseModel):
    """Request user data export (GDPR)."""
    user_id: str
    include_books: bool = True
    include_comments: bool = True
    include_activity: bool = True


