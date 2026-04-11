"""Enterprise features API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.enterprise import TeamMemberRole, AuditEventType
from app.services.enterprise import (
    TeamService,
    TeamMemberService,
    CustomRoleService,
    SSOService,
    AuditLogService,
    PermissionService,
    TeamActivityService,
)
from app.schemas.enterprise import (
    TeamCreate,
    TeamUpdate,
    TeamMemberInvite,
    TeamMemberUpdate,
    CustomRoleCreate,
    CustomRoleUpdate,
    SSOConfigCreate,
    SSOConfigUpdate,
    AuditLogCreate,
    AuditLogFilterRequest,
    ResourcePermissionGrant,
    BulkUserCreate,
)
from datetime import datetime
from typing import Optional


router = APIRouter(prefix="/enterprise", tags=["Enterprise"])


# ===== TEAMS =====

@router.post("/teams")
def create_team(data: TeamCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create new team."""
    team = TeamService.create_team(db, current_user.id, data)
    return {
        "id": team.id,
        "name": team.name,
        "slug": team.slug,
        "owner_id": team.owner_id,
        "created_at": team.created_at,
    }


@router.get("/teams")
def list_user_teams(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List teams user belongs to."""
    teams = TeamService.get_user_teams(db, current_user.id)
    return [
        {
            "id": t.id,
            "name": t.name,
            "slug": t.slug,
            "owner_id": t.owner_id,
            "member_count": len(t.members),
        }
        for t in teams
    ]


@router.get("/teams/{team_id}")
def get_team(team_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get team details."""
    team = TeamService.get_team(db, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check membership
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")
    
    return {
        "id": team.id,
        "name": team.name,
        "slug": team.slug,
        "description": team.description,
        "owner_id": team.owner_id,
        "max_members": team.max_members,
        "max_books": team.max_books,
        "member_count": len(team.members),
        "is_active": team.is_active,
        "created_at": team.created_at,
    }


@router.patch("/teams/{team_id}")
def update_team(team_id: str, data: TeamUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update team settings (owner only)."""
    team = TeamService.get_team(db, team_id)
    if not team or team.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    team = TeamService.update_team(db, team_id, data)
    return {"updated_at": team.updated_at}


@router.delete("/teams/{team_id}")
def delete_team(team_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete team (owner only)."""
    team = TeamService.get_team(db, team_id)
    if not team or team.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    success = TeamService.delete_team(db, team_id)
    return {"deleted": success}


# ===== TEAM MEMBERS =====

@router.post("/teams/{team_id}/members/invite")
def invite_member(team_id: str, data: TeamMemberInvite, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Invite user to team."""
    team = TeamService.get_team(db, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check permission (owner or manager)
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member or member.role not in [TeamMemberRole.OWNER, TeamMemberRole.LEAD]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    invited_member = TeamMemberService.invite_member(db, team_id, data, current_user.id)
    return {
        "id": invited_member.id,
        "email": data.email,
        "role": invited_member.role,
        "invited_at": invited_member.invited_at,
    }


@router.get("/teams/{team_id}/members")
def list_team_members(team_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List team members."""
    # Check membership
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")
    
    members = TeamMemberService.get_team_members(db, team_id)
    return [
        {
            "id": m.id,
            "user_id": m.user_id,
            "role": m.role,
            "accepted_at": m.accepted_at,
            "joined_at": m.joined_at,
        }
        for m in members
    ]


@router.patch("/teams/{team_id}/members/{user_id}")
def update_member(team_id: str, user_id: str, data: TeamMemberUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update team member role."""
    # Check permission
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member or member.role not in [TeamMemberRole.OWNER, TeamMemberRole.LEAD]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    updated_member = TeamMemberService.update_member(db, team_id, user_id, data)
    if not updated_member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    return {"updated_at": updated_member.updated_at}


@router.delete("/teams/{team_id}/members/{user_id}")
def remove_member(team_id: str, user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Remove member from team."""
    # Check permission
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member or member.role != TeamMemberRole.OWNER:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    success = TeamMemberService.remove_member(db, team_id, user_id)
    return {"removed": success}


# ===== CUSTOM ROLES =====

@router.post("/teams/{team_id}/roles")
def create_custom_role(team_id: str, data: CustomRoleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create custom role for team."""
    # Check permission (owner only)
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member or member.role != TeamMemberRole.OWNER:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    role = CustomRoleService.create_role(db, team_id, data)
    return {
        "id": role.id,
        "name": role.name,
        "permissions": role.permissions,
        "created_at": role.created_at,
    }


@router.get("/teams/{team_id}/roles")
def list_custom_roles(team_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List custom roles for team."""
    # Check membership
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")
    
    roles = CustomRoleService.get_team_roles(db, team_id)
    return [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "permissions": r.permissions,
        }
        for r in roles
    ]


@router.patch("/teams/{team_id}/roles/{role_id}")
def update_custom_role(team_id: str, role_id: str, data: CustomRoleUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update custom role."""
    # Check permission
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member or member.role != TeamMemberRole.OWNER:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    role = CustomRoleService.update_role(db, role_id, data)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    return {"updated_at": role.updated_at}


# ===== SSO CONFIGURATION =====

@router.post("/teams/{team_id}/sso")
def configure_sso(team_id: str, data: SSOConfigCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Configure SSO for team."""
    # Check permission (owner only)
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member or member.role != TeamMemberRole.OWNER:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    config = SSOService.create_sso_config(db, team_id, data)
    return {
        "id": config.id,
        "provider": config.provider,
        "is_enabled": config.is_enabled,
        "created_at": config.created_at,
    }


@router.get("/teams/{team_id}/sso/{provider}")
def get_sso_config(team_id: str, provider: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get SSO configuration for provider."""
    # Check membership
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")
    
    config = SSOService.get_sso_config(db, team_id, provider)
    if not config:
        raise HTTPException(status_code=404, detail="SSO not configured")
    
    return {
        "id": config.id,
        "provider": config.provider,
        "domain": config.domain,
        "auto_provision": config.auto_provision,
        "require_mfa": config.require_mfa,
        "is_enabled": config.is_enabled,
        "is_verified": config.is_verified,
    }


@router.patch("/teams/{team_id}/sso/{config_id}")
def update_sso_config(team_id: str, config_id: str, data: SSOConfigUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update SSO configuration."""
    # Check permission
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member or member.role != TeamMemberRole.OWNER:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    config = SSOService.update_sso_config(db, config_id, data)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    
    return {"updated_at": config.updated_at}


# ===== AUDIT LOGS =====

@router.get("/teams/{team_id}/audit-logs")
def get_audit_logs(
    team_id: str,
    event_type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get team audit logs."""
    # Check membership
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member or member.role != TeamMemberRole.OWNER:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    logs = AuditLogService.query_logs(db, team_id, event_type, start_date, end_date, limit, offset)
    
    return [
        {
            "id": log.id,
            "event_type": log.event_type,
            "actor_user_id": log.actor_user_id,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "action": log.action,
            "status": log.status,
            "created_at": log.created_at,
        }
        for log in logs
    ]


@router.get("/teams/{team_id}/audit-logs/{resource_id}")
def get_resource_history(team_id: str, resource_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get audit history for resource."""
    # Check membership
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member or member.role != TeamMemberRole.OWNER:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    logs = AuditLogService.get_resource_history(db, team_id, resource_id)
    
    return [
        {
            "id": log.id,
            "event_type": log.event_type,
            "action": log.action,
            "old_values": log.old_values,
            "new_values": log.new_values,
            "created_at": log.created_at,
        }
        for log in logs
    ]


# ===== PERMISSIONS =====

@router.post("/teams/{team_id}/permissions")
def grant_permission(team_id: str, data: ResourcePermissionGrant, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Grant resource-level permission."""
    # Check permission (owner only)
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member or member.role != TeamMemberRole.OWNER:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    permission = PermissionService.grant_permission(db, team_id, data)
    return {
        "id": permission.id,
        "permission_level": permission.permission_level,
        "granted_at": permission.granted_at,
    }


@router.get("/teams/{team_id}/permissions")
def get_user_permissions(team_id: str, user_id: str = Query(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get resource permissions for user."""
    # Check membership
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member or member.role != TeamMemberRole.OWNER:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    target_member = TeamMemberService.get_member(db, team_id, user_id)
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    permissions = PermissionService.get_user_permissions(db, target_member.id)
    
    return [
        {
            "id": p.id,
            "resource_type": p.resource_type,
            "resource_id": p.resource_id,
            "permission_level": p.permission_level,
            "granted_at": p.granted_at,
        }
        for p in permissions
    ]


@router.delete("/teams/{team_id}/permissions/{permission_id}")
def revoke_permission(team_id: str, permission_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Revoke resource permission."""
    # Check permission
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member or member.role != TeamMemberRole.OWNER:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    success = PermissionService.revoke_permission(db, permission_id)
    return {"revoked": success}


# ===== TEAM ANALYTICS =====

@router.get("/teams/{team_id}/stats")
def get_team_stats(team_id: str, days: int = Query(30), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get team statistics."""
    # Check membership
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")
    
    stats = TeamActivityService.get_team_stats(db, team_id, days)
    return stats


# ===== BULK OPERATIONS =====

@router.post("/teams/{team_id}/members/bulk-invite")
def bulk_invite_members(team_id: str, data: BulkUserCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Bulk invite users to team."""
    # Check permission
    member = TeamMemberService.get_member(db, team_id, current_user.id)
    if not member or member.role != TeamMemberRole.OWNER:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    invited_count = 0
    for user_invite in data.users:
        invite_data = TeamMemberInvite(email=user_invite.email, role=user_invite.role or data.role)
        invited = TeamMemberService.invite_member(db, team_id, invite_data, current_user.id)
        if invited:
            invited_count += 1
    
    return {"invited_count": invited_count, "total": len(data.users)}
