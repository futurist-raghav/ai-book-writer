from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class WorkspaceRole(str, Enum):
    """Workspace membership role levels"""
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class WorkspaceStatus(str, Enum):
    """Workspace lifecycle status"""
    ACTIVE = "active"
    ARCHIVED = "archived"
    SUSPENDED = "suspended"


# User DTO (for nested responses)
class UserBase(BaseModel):
    id: str
    email: str
    name: Optional[str] = None


# Workspace Member
class WorkspaceMemberCreate(BaseModel):
    user_id: str
    role: WorkspaceRole = WorkspaceRole.VIEWER


class WorkspaceMemberUpdate(BaseModel):
    role: WorkspaceRole


class WorkspaceMemberResponse(BaseModel):
    id: str
    user_id: str
    workspace_id: str
    role: WorkspaceRole
    joined_at: datetime
    invited_at: Optional[datetime] = None
    is_pending: bool
    is_archived: bool
    user: Optional[UserBase] = None

    class Config:
        from_attributes = True


# Style Guide
class StyleGuideCreate(BaseModel):
    name: str
    description: Optional[str] = None
    terminology: Optional[dict] = None
    voice_guidelines: Optional[dict] = None
    formatting_rules: Optional[dict] = None
    content_standards: Optional[dict] = None


class StyleGuideUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    terminology: Optional[dict] = None
    voice_guidelines: Optional[dict] = None
    formatting_rules: Optional[dict] = None
    content_standards: Optional[dict] = None
    is_default: Optional[bool] = None


class StyleGuideResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: Optional[str] = None
    terminology: Optional[dict] = None
    voice_guidelines: Optional[dict] = None
    formatting_rules: Optional[dict] = None
    content_standards: Optional[dict] = None
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Workspace Template
class WorkspaceTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    chapter_structure: Optional[dict] = None
    initial_metadata: Optional[dict] = None
    formatting_preset: Optional[str] = None
    matter_config: Optional[dict] = None


class WorkspaceTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    chapter_structure: Optional[dict] = None
    initial_metadata: Optional[dict] = None
    formatting_preset: Optional[str] = None
    matter_config: Optional[dict] = None
    is_public: Optional[bool] = None
    is_default: Optional[bool] = None


class WorkspaceTemplateResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: Optional[str] = None
    category: str
    chapter_structure: Optional[dict] = None
    initial_metadata: Optional[dict] = None
    formatting_preset: Optional[str] = None
    matter_config: Optional[dict] = None
    usage_count: int
    is_public: bool
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Workspace
class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    default_role: WorkspaceRole = WorkspaceRole.VIEWER
    allow_public_sharing: bool = True
    allow_member_invitations: bool = True


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[WorkspaceStatus] = None
    default_role: Optional[WorkspaceRole] = None
    allow_public_sharing: Optional[bool] = None
    allow_member_invitations: Optional[bool] = None
    is_default_workspace: Optional[bool] = None


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    owner_id: str
    status: WorkspaceStatus
    default_role: WorkspaceRole
    is_default_workspace: bool
    allow_public_sharing: bool
    allow_member_invitations: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkspaceDetailResponse(WorkspaceResponse):
    members: List[WorkspaceMemberResponse] = []
    member_count: int = 0


class WorkspaceListResponse(BaseModel):
    total_count: int
    workspaces: List[WorkspaceResponse]


class WorkspaceMemberListResponse(BaseModel):
    total_count: int
    members: List[WorkspaceMemberResponse]


class StyleGuideListResponse(BaseModel):
    total_count: int
    guides: List[StyleGuideResponse]


class WorkspaceTemplateListResponse(BaseModel):
    total_count: int
    templates: List[WorkspaceTemplateResponse]


# Settings/Preferences
class WorkspaceSettings(BaseModel):
    """Current user's workspace settings"""
    current_workspace_id: str
    available_workspaces: List[WorkspaceResponse]
    role_in_current: WorkspaceRole
    is_admin: bool = False


class WorkspaceSwitchRequest(BaseModel):
    workspace_id: str
