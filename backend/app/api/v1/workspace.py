from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import select, func
from uuid import UUID

from app.core.db import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.workspace import (
    Workspace,
    WorkspaceMember,
    StyleGuide,
    WorkspaceTemplate,
    WorkspaceRole,
    WorkspaceStatus,
)
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceResponse,
    WorkspaceDetailResponse,
    WorkspaceListResponse,
    WorkspaceMemberCreate,
    WorkspaceMemberUpdate,
    WorkspaceMemberResponse,
    WorkspaceMemberListResponse,
    StyleGuideCreate,
    StyleGuideUpdate,
    StyleGuideResponse,
    StyleGuideListResponse,
    WorkspaceTemplateCreate,
    WorkspaceTemplateUpdate,
    WorkspaceTemplateResponse,
    WorkspaceTemplateListResponse,
    WorkspaceSettings,
    WorkspaceSwitchRequest,
)

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])


# Helper functions
async def _check_workspace_access(
    db: AsyncSession,
    workspace_id: str,
    user: User,
    required_role: WorkspaceRole = WorkspaceRole.VIEWER,
) -> WorkspaceMember:
    """Check if user has access to workspace with minimum role"""
    result = await db.execute(
        select(WorkspaceMember).where(
            (WorkspaceMember.workspace_id == workspace_id)
            & (WorkspaceMember.user_id == user.id)
            & (~WorkspaceMember.is_archived)
        )
    )
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this workspace",
        )

    if member.role == WorkspaceRole.VIEWER and required_role in [
        WorkspaceRole.EDITOR,
        WorkspaceRole.ADMIN,
    ]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires {required_role} role",
        )

    if member.role == WorkspaceRole.EDITOR and required_role == WorkspaceRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires admin role",
        )

    return member


# ============================================================================
# WORKSPACE CRUD
# ============================================================================


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    request: WorkspaceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new workspace"""
    workspace = Workspace(
        name=request.name,
        description=request.description,
        owner_id=current_user.id,
        default_role=request.default_role,
        allow_public_sharing=request.allow_public_sharing,
        allow_member_invitations=request.allow_member_invitations,
    )

    # Add creator as admin member
    owner_member = WorkspaceMember(
        workspace=workspace,
        user_id=current_user.id,
        role=WorkspaceRole.ADMIN,
        is_pending=False,
    )

    db.add(workspace)
    db.add(owner_member)
    await db.commit()
    await db.refresh(workspace)

    return workspace


@router.get("", response_model=WorkspaceListResponse)
async def list_workspaces(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List all workspaces for current user"""
    # Get workspaces where user is a member
    result = await db.execute(
        select(func.count(Workspace.id)).join(WorkspaceMember).where(
            (WorkspaceMember.user_id == current_user.id)
            & (~WorkspaceMember.is_archived)
        )
    )
    total_count = result.scalar() or 0

    result = await db.execute(
        select(Workspace)
        .join(WorkspaceMember)
        .where(
            (WorkspaceMember.user_id == current_user.id)
            & (~WorkspaceMember.is_archived)
        )
        .offset(skip)
        .limit(limit)
    )
    workspaces = result.scalars().all()

    return WorkspaceListResponse(
        total_count=total_count, workspaces=[WorkspaceResponse.from_orm(w) for w in workspaces]
    )


@router.get("/{workspace_id}", response_model=WorkspaceDetailResponse)
async def get_workspace(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get workspace details with member list"""
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = result.scalar_one_or_none()

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Check access
    await _check_workspace_access(db, workspace_id, current_user)

    # Get members
    result = await db.execute(
        select(WorkspaceMember).where(
            (WorkspaceMember.workspace_id == workspace_id)
            & (~WorkspaceMember.is_archived)
        )
    )
    members = result.scalars().all()

    return WorkspaceDetailResponse(
        **WorkspaceResponse.from_orm(workspace).dict(),
        members=[WorkspaceMemberResponse.from_orm(m) for m in members],
        member_count=len(members),
    )


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: str,
    request: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update workspace settings (admin only)"""
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = result.scalar_one_or_none()

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Check admin access
    await _check_workspace_access(db, workspace_id, current_user, WorkspaceRole.ADMIN)

    # Update fields
    update_data = request.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(workspace, field, value)

    await db.commit()
    await db.refresh(workspace)

    return workspace


# ============================================================================
# WORKSPACE MEMBERS
# ============================================================================


@router.get("/{workspace_id}/members", response_model=WorkspaceMemberListResponse)
async def list_workspace_members(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List workspace members"""
    await _check_workspace_access(db, workspace_id, current_user)

    result = await db.execute(
        select(func.count(WorkspaceMember.id)).where(
            (WorkspaceMember.workspace_id == workspace_id)
            & (~WorkspaceMember.is_archived)
        )
    )
    total_count = result.scalar() or 0

    result = await db.execute(
        select(WorkspaceMember)
        .where(
            (WorkspaceMember.workspace_id == workspace_id)
            & (~WorkspaceMember.is_archived)
        )
        .offset(skip)
        .limit(limit)
    )
    members = result.scalars().all()

    return WorkspaceMemberListResponse(
        total_count=total_count,
        members=[WorkspaceMemberResponse.from_orm(m) for m in members],
    )


@router.post("/{workspace_id}/members", response_model=WorkspaceMemberResponse, status_code=status.HTTP_201_CREATED)
async def invite_workspace_member(
    workspace_id: str,
    request: WorkspaceMemberCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Invite a member to workspace (editor/admin only)"""
    await _check_workspace_access(db, workspace_id, current_user, WorkspaceRole.EDITOR)

    # Check if user already a member
    result = await db.execute(
        select(WorkspaceMember).where(
            (WorkspaceMember.workspace_id == workspace_id)
            & (WorkspaceMember.user_id == request.user_id)
        )
    )
    existing = result.scalar_one_or_none()

    if existing and not existing.is_archived:
        raise HTTPException(
            status_code=409, detail="User is already a member of this workspace"
        )

    member = WorkspaceMember(
        workspace_id=workspace_id,
        user_id=request.user_id,
        role=request.role,
        invited_by_id=current_user.id,
        is_pending=True,
    )

    db.add(member)
    await db.commit()
    await db.refresh(member)

    return member


@router.patch("/{workspace_id}/members/{member_id}", response_model=WorkspaceMemberResponse)
async def update_workspace_member(
    workspace_id: str,
    member_id: str,
    request: WorkspaceMemberUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update member role (admin only)"""
    await _check_workspace_access(db, workspace_id, current_user, WorkspaceRole.ADMIN)

    result = await db.execute(
        select(WorkspaceMember).where(
            (WorkspaceMember.id == member_id)
            & (WorkspaceMember.workspace_id == workspace_id)
        )
    )
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    member.role = request.role
    await db.commit()
    await db.refresh(member)

    return member


@router.delete("/{workspace_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_workspace_member(
    workspace_id: str,
    member_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove member from workspace (admin only)"""
    await _check_workspace_access(db, workspace_id, current_user, WorkspaceRole.ADMIN)

    result = await db.execute(
        select(WorkspaceMember).where(
            (WorkspaceMember.id == member_id)
            & (WorkspaceMember.workspace_id == workspace_id)
        )
    )
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Soft delete
    member.is_archived = True
    await db.commit()


@router.post("/{workspace_id}/members/{member_id}/accept", response_model=WorkspaceMemberResponse)
async def accept_workspace_invitation(
    workspace_id: str,
    member_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept workspace invitation (member only)"""
    result = await db.execute(
        select(WorkspaceMember).where(
            (WorkspaceMember.id == member_id)
            & (WorkspaceMember.workspace_id == workspace_id)
        )
    )
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if member.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot accept invitation for another user")

    member.is_pending = False
    await db.commit()
    await db.refresh(member)

    return member


# ============================================================================
# STYLE GUIDES
# ============================================================================


@router.get("/{workspace_id}/style-guides", response_model=StyleGuideListResponse)
async def list_style_guides(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List workspace style guides"""
    await _check_workspace_access(db, workspace_id, current_user)

    result = await db.execute(
        select(func.count(StyleGuide.id)).where(StyleGuide.workspace_id == workspace_id)
    )
    total_count = result.scalar() or 0

    result = await db.execute(
        select(StyleGuide)
        .where(StyleGuide.workspace_id == workspace_id)
        .offset(skip)
        .limit(limit)
    )
    guides = result.scalars().all()

    return StyleGuideListResponse(
        total_count=total_count,
        guides=[StyleGuideResponse.from_orm(g) for g in guides],
    )


@router.post("/{workspace_id}/style-guides", response_model=StyleGuideResponse, status_code=status.HTTP_201_CREATED)
async def create_style_guide(
    workspace_id: str,
    request: StyleGuideCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create workspace style guide (editor/admin only)"""
    await _check_workspace_access(db, workspace_id, current_user, WorkspaceRole.EDITOR)

    guide = StyleGuide(
        workspace_id=workspace_id,
        created_by_id=current_user.id,
        **request.dict(),
    )

    db.add(guide)
    await db.commit()
    await db.refresh(guide)

    return guide


@router.patch("/{workspace_id}/style-guides/{guide_id}", response_model=StyleGuideResponse)
async def update_style_guide(
    workspace_id: str,
    guide_id: str,
    request: StyleGuideUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update style guide (editor/admin only)"""
    await _check_workspace_access(db, workspace_id, current_user, WorkspaceRole.EDITOR)

    result = await db.execute(
        select(StyleGuide).where(
            (StyleGuide.id == guide_id)
            & (StyleGuide.workspace_id == workspace_id)
        )
    )
    guide = result.scalar_one_or_none()

    if not guide:
        raise HTTPException(status_code=404, detail="Style guide not found")

    update_data = request.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(guide, field, value)

    await db.commit()
    await db.refresh(guide)

    return guide


# ============================================================================
# WORKSPACE TEMPLATES
# ============================================================================


@router.get("/{workspace_id}/templates", response_model=WorkspaceTemplateListResponse)
async def list_workspace_templates(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List workspace templates"""
    await _check_workspace_access(db, workspace_id, current_user)

    result = await db.execute(
        select(func.count(WorkspaceTemplate.id)).where(WorkspaceTemplate.workspace_id == workspace_id)
    )
    total_count = result.scalar() or 0

    result = await db.execute(
        select(WorkspaceTemplate)
        .where(WorkspaceTemplate.workspace_id == workspace_id)
        .offset(skip)
        .limit(limit)
    )
    templates = result.scalars().all()

    return WorkspaceTemplateListResponse(
        total_count=total_count,
        templates=[WorkspaceTemplateResponse.from_orm(t) for t in templates],
    )


@router.post("/{workspace_id}/templates", response_model=WorkspaceTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace_template(
    workspace_id: str,
    request: WorkspaceTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create workspace template (editor/admin only)"""
    await _check_workspace_access(db, workspace_id, current_user, WorkspaceRole.EDITOR)

    template = WorkspaceTemplate(
        workspace_id=workspace_id,
        created_by_id=current_user.id,
        **request.dict(),
    )

    db.add(template)
    await db.commit()
    await db.refresh(template)

    return template


@router.patch("/{workspace_id}/templates/{template_id}", response_model=WorkspaceTemplateResponse)
async def update_workspace_template(
    workspace_id: str,
    template_id: str,
    request: WorkspaceTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update workspace template (editor/admin only)"""
    await _check_workspace_access(db, workspace_id, current_user, WorkspaceRole.EDITOR)

    result = await db.execute(
        select(WorkspaceTemplate).where(
            (WorkspaceTemplate.id == template_id)
            & (WorkspaceTemplate.workspace_id == workspace_id)
        )
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data = request.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)

    return template


# ============================================================================
# USER WORKSPACE SETTINGS
# ============================================================================


@router.get("/user/settings", response_model=WorkspaceSettings)
async def get_workspace_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user's workspace settings and available workspaces"""
    # Get all user's workspaces
    result = await db.execute(
        select(Workspace)
        .join(WorkspaceMember)
        .where(
            (WorkspaceMember.user_id == current_user.id)
            & (~WorkspaceMember.is_archived)
        )
    )
    workspaces = result.scalars().all()

    # Get current workspace (first one or default)
    current_workspace = next((w for w in workspaces if w.is_default_workspace), None) or (
        workspaces[0] if workspaces else None
    )

    if not current_workspace:
        raise HTTPException(status_code=400, detail="No workspaces available")

    # Get user's role in current workspace
    result = await db.execute(
        select(WorkspaceMember).where(
            (WorkspaceMember.workspace_id == current_workspace.id)
            & (WorkspaceMember.user_id == current_user.id)
        )
    )
    member = result.scalar_one_or_none()

    return WorkspaceSettings(
        current_workspace_id=current_workspace.id,
        available_workspaces=[WorkspaceResponse.from_orm(w) for w in workspaces],
        role_in_current=member.role if member else WorkspaceRole.VIEWER,
        is_admin=member.role == WorkspaceRole.ADMIN if member else False,
    )


@router.post("/user/switch-workspace")
async def switch_workspace(
    request: WorkspaceSwitchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Switch user's current workspace"""
    # Check access
    await _check_workspace_access(db, request.workspace_id, current_user)

    # Update default workspace flag
    # Reset all workspaces for this user
    result = await db.execute(
        select(Workspace)
        .join(WorkspaceMember)
        .where(
            (WorkspaceMember.user_id == current_user.id)
            & (Workspace.is_default_workspace == True)
        )
    )
    old_defaults = result.scalars().all()
    for ws in old_defaults:
        ws.is_default_workspace = False

    # Set new default
    result = await db.execute(
        select(Workspace).where(Workspace.id == request.workspace_id)
    )
    new_default = result.scalar_one_or_none()
    if new_default:
        new_default.is_default_workspace = True

    await db.commit()

    return {"message": "Workspace switched", "workspace_id": request.workspace_id}
