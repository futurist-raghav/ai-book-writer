"""P7.7 Enterprise Features - team management, SSO, audit logs, advanced permissions.

Revision ID: 021
Revises: 020
Create Date: 2024-01-21 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from uuid import uuid4
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '021'
down_revision = '020'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create enterprise feature tables: teams, members, roles, SSO, audit logs, permissions."""
    
    # === TEAMS ===
    op.create_table(
        'teams',
        sa.Column('id', sa.String(36), primary_key=True, default=lambda: str(uuid4())),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('slug', sa.String(256), nullable=False, unique=True, index=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('owner_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('max_members', sa.Integer, default=50, nullable=False),
        sa.Column('max_books', sa.Integer, default=100, nullable=False),
        sa.Column('max_api_keys', sa.Integer, default=10, nullable=False),
        sa.Column('settings', postgresql.JSON, nullable=True),
        sa.Column('logo_url', sa.String(512), nullable=True),
        sa.Column('website_url', sa.String(512), nullable=True),
        sa.Column('is_active', sa.Boolean, default=True, nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Index('idx_teams_owner_id', 'owner_id'),
    )
    
    # === TEAM MEMBERS ===
    op.create_table(
        'team_members',
        sa.Column('id', sa.String(36), primary_key=True, default=lambda: str(uuid4())),
        sa.Column('team_id', sa.String(36), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('role', sa.String(20), nullable=False, default='member', index=True),
        sa.Column('custom_role_id', sa.String(36), sa.ForeignKey('custom_roles.id', ondelete='SET NULL'), nullable=True),
        sa.Column('permissions', postgresql.JSON, nullable=True),
        sa.Column('is_active', sa.Boolean, default=True, nullable=False, index=True),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('invited_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('invited_by', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    
    # === CUSTOM ROLES ===
    op.create_table(
        'custom_roles',
        sa.Column('id', sa.String(36), primary_key=True, default=lambda: str(uuid4())),
        sa.Column('team_id', sa.String(36), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('permissions', postgresql.JSON, nullable=False),
        sa.Column('is_archived', sa.Boolean, default=False, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    
    # === SSO CONFIGURATION ===
    op.create_table(
        'sso_configs',
        sa.Column('id', sa.String(36), primary_key=True, default=lambda: str(uuid4())),
        sa.Column('team_id', sa.String(36), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('provider', sa.String(50), nullable=False, index=True),
        sa.Column('client_id', sa.String(256), nullable=False),
        sa.Column('client_secret', sa.String(512), nullable=False),
        sa.Column('tenant_id', sa.String(256), nullable=True),
        sa.Column('domain', sa.String(256), nullable=True),
        sa.Column('entity_id', sa.String(512), nullable=True),
        sa.Column('sso_url', sa.String(512), nullable=True),
        sa.Column('certificate', sa.Text, nullable=True),
        sa.Column('auto_provision', sa.Boolean, default=True, nullable=False),
        sa.Column('require_mfa', sa.Boolean, default=False, nullable=False),
        sa.Column('sync_groups', sa.Boolean, default=False, nullable=False),
        sa.Column('is_enabled', sa.Boolean, default=True, nullable=False),
        sa.Column('is_verified', sa.Boolean, default=False, nullable=False),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    
    # === AUDIT LOGS ===
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(36), primary_key=True, default=lambda: str(uuid4())),
        sa.Column('team_id', sa.String(36), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('team_member_id', sa.String(36), sa.ForeignKey('team_members.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('event_type', sa.String(50), nullable=False, index=True),
        sa.Column('actor_user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('resource_type', sa.String(50), nullable=False),
        sa.Column('resource_id', sa.String(36), nullable=False, index=True),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('old_values', postgresql.JSON, nullable=True),
        sa.Column('new_values', postgresql.JSON, nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(512), nullable=True),
        sa.Column('status', sa.String(20), default='success', nullable=False),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Index('idx_audit_logs_created_at', 'created_at'),
        sa.Index('idx_audit_logs_actor_user_id', 'actor_user_id'),
    )
    
    # === RESOURCE PERMISSIONS ===
    op.create_table(
        'resource_permissions',
        sa.Column('id', sa.String(36), primary_key=True, default=lambda: str(uuid4())),
        sa.Column('team_id', sa.String(36), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('team_member_id', sa.String(36), sa.ForeignKey('team_members.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('resource_type', sa.String(50), nullable=False),
        sa.Column('resource_id', sa.String(36), nullable=False, index=True),
        sa.Column('permission_level', sa.String(20), nullable=False),
        sa.Column('conditions', postgresql.JSON, nullable=True),
        sa.Column('granted_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('granted_by', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    )
    
    # === TEAM ACTIVITY LOGS ===
    op.create_table(
        'team_activity_logs',
        sa.Column('id', sa.String(36), primary_key=True, default=lambda: str(uuid4())),
        sa.Column('team_id', sa.String(36), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('date', sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column('active_members', sa.Integer, default=0, nullable=False),
        sa.Column('total_edits', sa.Integer, default=0, nullable=False),
        sa.Column('total_comments', sa.Integer, default=0, nullable=False),
        sa.Column('books_created', sa.Integer, default=0, nullable=False),
        sa.Column('chapters_created', sa.Integer, default=0, nullable=False),
        sa.Column('ai_calls', sa.Integer, default=0, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    """Drop enterprise feature tables."""
    op.drop_table('team_activity_logs')
    op.drop_table('resource_permissions')
    op.drop_table('audit_logs')
    op.drop_table('sso_configs')
    op.drop_table('custom_roles')
    op.drop_table('team_members')
    op.drop_table('teams')
