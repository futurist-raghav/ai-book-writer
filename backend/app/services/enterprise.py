"""Enterprise features services: team management, SSO, audit logging, permissions."""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from app.models.enterprise import (
    Team, TeamMember, CustomRole, SSOConfig, AuditLog, ResourcePermission, TeamActivityLog,
    TeamMemberRole, SSOProvider, AuditEventType, PermissionLevel
)
from app.schemas.enterprise import (
    TeamCreate, TeamUpdate, TeamMemberInvite, TeamMemberUpdate,
    CustomRoleCreate, CustomRoleUpdate, SSOConfigCreate, SSOConfigUpdate,
    AuditLogCreate, ResourcePermissionGrant
)
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from uuid import uuid4
import base64
import hmac
import hashlib


class TeamService:
    """Team management service."""
    
    @staticmethod
    def create_team(db: Session, owner_id: str, data: TeamCreate) -> Team:
        """Create new team."""
        team = Team(
            id=str(uuid4()),
            owner_id=owner_id,
            name=data.name,
            slug=data.slug,
            description=data.description,
            logo_url=data.logo_url,
            website_url=data.website_url,
            max_members=50,  # Default tier
            max_books=100,
            max_api_keys=10,
        )
        db.add(team)
        db.flush()
        
        # Add owner as team member
        member = TeamMember(
            id=str(uuid4()),
            team_id=team.id,
            user_id=owner_id,
            role=TeamMemberRole.OWNER,
            accepted_at=datetime.utcnow(),
        )
        db.add(member)
        db.commit()
        return team
    
    @staticmethod
    def update_team(db: Session, team_id: str, data: TeamUpdate) -> Team:
        """Update team settings."""
        team = db.query(Team).filter(Team.id == team_id).first()
        if not team:
            return None
        
        if data.name:
            team.name = data.name
        if data.description is not None:
            team.description = data.description
        if data.logo_url is not None:
            team.logo_url = data.logo_url
        if data.website_url is not None:
            team.website_url = data.website_url
        if data.settings:
            team.settings = data.settings
        
        db.commit()
        return team
    
    @staticmethod
    def get_team(db: Session, team_id: str) -> Team:
        """Get team by ID."""
        return db.query(Team).filter(Team.id == team_id).first()
    
    @staticmethod
    def get_user_teams(db: Session, user_id: str) -> List[Team]:
        """Get all teams user is member of."""
        return db.query(Team).join(
            TeamMember, Team.id == TeamMember.team_id
        ).filter(
            TeamMember.user_id == user_id,
            TeamMember.is_active == True
        ).all()
    
    @staticmethod
    def delete_team(db: Session, team_id: str) -> bool:
        """Soft delete team."""
        team = db.query(Team).filter(Team.id == team_id).first()
        if not team:
            return False
        
        team.is_active = False
        db.commit()
        return True
    
    @staticmethod
    def check_limit(db: Session, team_id: str, resource_type: str) -> bool:
        """Check if team has reached resource limit."""
        team = db.query(Team).filter(Team.id == team_id).first()
        if not team:
            return False
        
        if resource_type == "members":
            count = db.query(TeamMember).filter(
                TeamMember.team_id == team_id,
                TeamMember.is_active == True
            ).count()
            return count < team.max_members
        
        elif resource_type == "books":
            # Count books owned by team members
            from app.models.book import Book
            count = db.query(Book).join(
                TeamMember, Book.user_id == TeamMember.user_id
            ).filter(
                TeamMember.team_id == team_id
            ).count()
            return count < team.max_books
        
        elif resource_type == "api_keys":
            from app.models.api_integrations import APIKey
            count = db.query(APIKey).join(
                TeamMember, APIKey.user_id == TeamMember.user_id
            ).filter(
                TeamMember.team_id == team_id
            ).count()
            return count < team.max_api_keys
        
        return True


class TeamMemberService:
    """Team member management."""
    
    @staticmethod
    def invite_member(db: Session, team_id: str, data: TeamMemberInvite, invited_by_id: str) -> TeamMember:
        """Invite user to team by email."""
        from app.models.user import User
        
        # Find user by email
        user = db.query(User).filter(User.email == data.email).first()
        if not user:
            # TODO: In production, send invite email and create invite link
            return None
        
        # Check if already member
        existing = db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user.id
        ).first()
        if existing:
            return existing
        
        member = TeamMember(
            id=str(uuid4()),
            team_id=team_id,
            user_id=user.id,
            role=data.role,
            invited_by=invited_by_id,
            invited_at=datetime.utcnow(),
            is_active=True,
        )
        db.add(member)
        db.commit()
        return member
    
    @staticmethod
    def accept_invite(db: Session, team_id: str, user_id: str) -> TeamMember:
        """Accept team invitation."""
        member = db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id
        ).first()
        
        if member:
            member.accepted_at = datetime.utcnow()
            db.commit()
        
        return member
    
    @staticmethod
    def update_member(db: Session, team_id: str, user_id: str, data: TeamMemberUpdate) -> TeamMember:
        """Update team member role/permissions."""
        member = db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id
        ).first()
        
        if not member:
            return None
        
        if data.role:
            member.role = data.role
        if data.permissions:
            member.permissions = data.permissions
        if data.custom_role_id:
            member.custom_role_id = data.custom_role_id
        
        db.commit()
        return member
    
    @staticmethod
    def remove_member(db: Session, team_id: str, user_id: str) -> bool:
        """Remove member from team."""
        member = db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id
        ).first()
        
        if not member:
            return False
        
        member.is_active = False
        db.commit()
        return True
    
    @staticmethod
    def get_team_members(db: Session, team_id: str) -> List[TeamMember]:
        """Get all team members."""
        return db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.is_active == True
        ).all()
    
    @staticmethod
    def get_member(db: Session, team_id: str, user_id: str) -> TeamMember:
        """Get single team member."""
        return db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id
        ).first()


class CustomRoleService:
    """Custom role management."""
    
    @staticmethod
    def create_role(db: Session, team_id: str, data: CustomRoleCreate) -> CustomRole:
        """Create custom role."""
        role = CustomRole(
            id=str(uuid4()),
            team_id=team_id,
            name=data.name,
            description=data.description,
            permissions=data.permissions,
        )
        db.add(role)
        db.commit()
        return role
    
    @staticmethod
    def update_role(db: Session, role_id: str, data: CustomRoleUpdate) -> CustomRole:
        """Update custom role."""
        role = db.query(CustomRole).filter(CustomRole.id == role_id).first()
        if not role:
            return None
        
        if data.name:
            role.name = data.name
        if data.description is not None:
            role.description = data.description
        if data.permissions:
            role.permissions = data.permissions
        
        db.commit()
        return role
    
    @staticmethod
    def delete_role(db: Session, role_id: str) -> bool:
        """Archive custom role."""
        role = db.query(CustomRole).filter(CustomRole.id == role_id).first()
        if not role:
            return False
        
        role.is_archived = True
        db.commit()
        return True
    
    @staticmethod
    def get_team_roles(db: Session, team_id: str) -> List[CustomRole]:
        """Get all custom roles for team."""
        return db.query(CustomRole).filter(
            CustomRole.team_id == team_id,
            CustomRole.is_archived == False
        ).all()


class SSOService:
    """Single Sign-On management."""
    
    @staticmethod
    def create_sso_config(db: Session, team_id: str, data: SSOConfigCreate) -> SSOConfig:
        """Create SSO configuration."""
        config = SSOConfig(
            id=str(uuid4()),
            team_id=team_id,
            provider=data.provider,
            client_id=data.client_id,
            client_secret=data.client_secret,  # Should encrypt in production
            tenant_id=data.tenant_id,
            domain=data.domain,
            entity_id=data.entity_id,
            sso_url=data.sso_url,
            certificate=data.certificate,
            auto_provision=data.auto_provision,
            require_mfa=data.require_mfa,
            sync_groups=data.sync_groups,
            is_enabled=True,
        )
        db.add(config)
        db.commit()
        return config
    
    @staticmethod
    def update_sso_config(db: Session, config_id: str, data: SSOConfigUpdate) -> SSOConfig:
        """Update SSO configuration."""
        config = db.query(SSOConfig).filter(SSOConfig.id == config_id).first()
        if not config:
            return None
        
        if data.client_secret:
            config.client_secret = data.client_secret
        if data.domain is not None:
            config.domain = data.domain
        if data.auto_provision is not None:
            config.auto_provision = data.auto_provision
        if data.require_mfa is not None:
            config.require_mfa = data.require_mfa
        if data.sync_groups is not None:
            config.sync_groups = data.sync_groups
        if data.is_enabled is not None:
            config.is_enabled = data.is_enabled
        
        db.commit()
        return config
    
    @staticmethod
    def get_sso_config(db: Session, team_id: str, provider: str) -> SSOConfig:
        """Get SSO config for team."""
        return db.query(SSOConfig).filter(
            SSOConfig.team_id == team_id,
            SSOConfig.provider == provider
        ).first()
    
    @staticmethod
    def verify_saml_signature(config: SSOConfig, signed_message: str, signature: str) -> bool:
        """Verify SAML signature."""
        # In production: actual SAML signature verification
        # For now: stub
        if not config.certificate:
            return False
        return True
    
    @staticmethod
    def generate_oauth_state() -> str:
        """Generate OAuth state parameter."""
        return base64.urlsafe_b64encode(str(uuid4()).encode()).decode().rstrip('=')


class AuditLogService:
    """Audit logging service."""
    
    @staticmethod
    def log_event(db: Session, team_id: str, team_member_id: Optional[str],
                 data: AuditLogCreate, actor_user_id: Optional[str] = None) -> AuditLog:
        """Log audit event."""
        log = AuditLog(
            id=str(uuid4()),
            team_id=team_id,
            team_member_id=team_member_id,
            event_type=data.event_type,
            actor_user_id=actor_user_id,
            resource_type=data.resource_type,
            resource_id=data.resource_id,
            action=data.action,
            old_values=data.old_values,
            new_values=data.new_values,
            ip_address=data.ip_address,
            user_agent=data.user_agent,
            status="success",
        )
        db.add(log)
        db.commit()
        return log
    
    @staticmethod
    def log_error(db: Session, team_id: str, team_member_id: Optional[str],
                 event_type: AuditEventType, resource_type: str, resource_id: str,
                 error_message: str, actor_user_id: Optional[str] = None) -> AuditLog:
        """Log failed audit event."""
        log = AuditLog(
            id=str(uuid4()),
            team_id=team_id,
            team_member_id=team_member_id,
            event_type=event_type,
            actor_user_id=actor_user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            action="attempt",
            status="failure",
            error_message=error_message,
        )
        db.add(log)
        db.commit()
        return log
    
    @staticmethod
    def query_logs(db: Session, team_id: str, event_type: Optional[str] = None,
                  start_date: Optional[datetime] = None, end_date: Optional[datetime] = None,
                  limit: int = 100, offset: int = 0) -> List[AuditLog]:
        """Query audit logs with filtering."""
        query = db.query(AuditLog).filter(AuditLog.team_id == team_id)
        
        if event_type:
            query = query.filter(AuditLog.event_type == event_type)
        
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)
        
        return query.order_by(desc(AuditLog.created_at)).limit(limit).offset(offset).all()
    
    @staticmethod
    def get_resource_history(db: Session, team_id: str, resource_id: str) -> List[AuditLog]:
        """Get full history of changes to a resource."""
        return db.query(AuditLog).filter(
            AuditLog.team_id == team_id,
            AuditLog.resource_id == resource_id
        ).order_by(desc(AuditLog.created_at)).all()


class PermissionService:
    """Resource-level permission management."""
    
    @staticmethod
    def grant_permission(db: Session, team_id: str, data: ResourcePermissionGrant) -> ResourcePermission:
        """Grant resource permission."""
        permission = ResourcePermission(
            id=str(uuid4()),
            team_id=team_id,
            team_member_id=data.team_member_id,
            resource_type=data.resource_type,
            resource_id=data.resource_id,
            permission_level=data.permission_level,
            conditions=data.conditions,
        )
        db.add(permission)
        db.commit()
        return permission
    
    @staticmethod
    def revoke_permission(db: Session, permission_id: str) -> bool:
        """Revoke resource permission."""
        permission = db.query(ResourcePermission).filter(
            ResourcePermission.id == permission_id
        ).first()
        
        if not permission:
            return False
        
        db.delete(permission)
        db.commit()
        return True
    
    @staticmethod
    def check_permission(db: Session, team_member_id: str, resource_id: str,
                        required_level: PermissionLevel) -> bool:
        """Check if team member has resource permission."""
        permission = db.query(ResourcePermission).filter(
            ResourcePermission.team_member_id == team_member_id,
            ResourcePermission.resource_id == resource_id
        ).first()
        
        if not permission:
            return False
        
        # Check conditions (e.g., time-limited)
        if permission.conditions and permission.conditions.get("time_limited"):
            expires_at = permission.conditions.get("expires_at")
            if expires_at and datetime.fromisoformat(expires_at) < datetime.utcnow():
                return False
        
        # Check permission level hierarchy
        levels = [PermissionLevel.NONE, PermissionLevel.VIEW, PermissionLevel.COMMENT,
                 PermissionLevel.EDIT, PermissionLevel.DELETE, PermissionLevel.ADMIN]
        
        user_level_idx = levels.index(permission.permission_level)
        required_level_idx = levels.index(required_level)
        
        return user_level_idx >= required_level_idx
    
    @staticmethod
    def get_user_permissions(db: Session, team_member_id: str) -> List[ResourcePermission]:
        """Get all permissions for team member."""
        return db.query(ResourcePermission).filter(
            ResourcePermission.team_member_id == team_member_id
        ).all()


class TeamActivityService:
    """Team activity tracking & analytics."""
    
    @staticmethod
    def log_activity(db: Session, team_id: str, date: datetime, **metrics) -> TeamActivityLog:
        """Log daily team activity."""
        log = TeamActivityLog(
            id=str(uuid4()),
            team_id=team_id,
            date=date,
            active_members=metrics.get("active_members", 0),
            total_edits=metrics.get("total_edits", 0),
            total_comments=metrics.get("total_comments", 0),
            books_created=metrics.get("books_created", 0),
            chapters_created=metrics.get("chapters_created", 0),
            ai_calls=metrics.get("ai_calls", 0),
        )
        db.add(log)
        db.commit()
        return log
    
    @staticmethod
    def get_team_stats(db: Session, team_id: str, days: int = 30) -> Dict[str, Any]:
        """Get team statistics summary."""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        logs = db.query(TeamActivityLog).filter(
            TeamActivityLog.team_id == team_id,
            TeamActivityLog.date >= start_date
        ).order_by(desc(TeamActivityLog.date)).all()
        
        return {
            "period_days": days,
            "total_edits": sum(log.total_edits for log in logs),
            "total_comments": sum(log.total_comments for log in logs),
            "total_books_created": sum(log.books_created for log in logs),
            "total_chapters_created": sum(log.chapters_created for log in logs),
            "total_ai_calls": sum(log.ai_calls for log in logs),
            "avg_active_members": int(sum(log.active_members for log in logs) / len(logs)) if logs else 0,
            "daily_breakdown": [
                {
                    "date": log.date,
                    "edits": log.total_edits,
                    "comments": log.total_comments,
                    "books": log.books_created,
                    "chapters": log.chapters_created,
                }
                for log in logs
            ],
        }
