"""Add API integrations models.

Revision ID: 019_api_integrations
Revises: 018_monetization
Create Date: 2024-01-01

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by alembic.
revision = '019_api_integrations'
down_revision = '018_monetization'
branch_labels = None
depends_on = None


def upgrade():
    """Create API integration tables."""
    
    # APIKey
    op.create_table(
        'api_keys',
        sa.Column('id', sa.String(36), nullable=False, primary_key=True),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('key_hash', sa.String(255), nullable=False),
        sa.Column('key_prefix', sa.String(8), nullable=False),
        sa.Column('scopes', sa.JSON),
        sa.Column('status', sa.String(50), default='active'),
        sa.Column('last_used_at', sa.DateTime),
        sa.Column('use_count', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime),
        sa.Column('revoked_at', sa.DateTime),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_api_keys_user_id', 'api_keys', ['user_id'])
    
    # Webhook
    op.create_table(
        'webhooks',
        sa.Column('id', sa.String(36), nullable=False, primary_key=True),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('events', sa.JSON),
        sa.Column('headers', sa.JSON),
        sa.Column('is_active', sa.Integer, default=1),
        sa.Column('retry_count', sa.Integer, default=0),
        sa.Column('max_retries', sa.Integer, default=5),
        sa.Column('delivery_count', sa.Integer, default=0),
        sa.Column('failure_count', sa.Integer, default=0),
        sa.Column('last_delivery_at', sa.DateTime),
        sa.Column('last_error', sa.Text),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_webhooks_user_id', 'webhooks', ['user_id'])
    
    # WebhookDelivery
    op.create_table(
        'webhook_deliveries',
        sa.Column('id', sa.String(36), nullable=False, primary_key=True),
        sa.Column('webhook_id', sa.String(36), nullable=False),
        sa.Column('event', sa.String(100), nullable=False),
        sa.Column('payload', sa.JSON),
        sa.Column('request_headers', sa.JSON),
        sa.Column('status_code', sa.Integer),
        sa.Column('response_body', sa.Text),
        sa.Column('response_time_ms', sa.Integer),
        sa.Column('attempt_number', sa.Integer, default=1),
        sa.Column('next_retry_at', sa.DateTime),
        sa.Column('delivered_at', sa.DateTime, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['webhook_id'], ['webhooks.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_webhook_deliveries_webhook_id', 'webhook_deliveries', ['webhook_id'])
    
    # IntegrationAuth
    op.create_table(
        'integration_auths',
        sa.Column('id', sa.String(36), nullable=False, primary_key=True),
        sa.Column('user_id', sa.String(36), nullable=False, unique=True),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('oauth_access_token', sa.Text),
        sa.Column('oauth_refresh_token', sa.Text),
        sa.Column('oauth_expires_at', sa.DateTime),
        sa.Column('provider_user_id', sa.String(255)),
        sa.Column('provider_workspace_id', sa.String(255)),
        sa.Column('sync_enabled', sa.Integer, default=1),
        sa.Column('sync_interval_minutes', sa.Integer, default=60),
        sa.Column('last_sync_at', sa.DateTime),
        sa.Column('is_active', sa.Integer, default=1),
        sa.Column('last_error', sa.Text),
        sa.Column('error_count', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_integration_auths_user_id', 'integration_auths', ['user_id'])
    
    # NotionSync
    op.create_table(
        'notion_syncs',
        sa.Column('id', sa.String(36), nullable=False, primary_key=True),
        sa.Column('auth_id', sa.String(36), nullable=False, unique=True),
        sa.Column('notion_database_id', sa.String(255), nullable=False),
        sa.Column('notion_database_name', sa.String(255)),
        sa.Column('mapping', sa.JSON),
        sa.Column('direction', sa.String(50), default='two-way'),
        sa.Column('last_sync_at', sa.DateTime),
        sa.Column('synced_records_count', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['auth_id'], ['integration_auths.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_notion_syncs_auth_id', 'notion_syncs', ['auth_id'])
    
    # GoogleDocsSync
    op.create_table(
        'google_docs_syncs',
        sa.Column('id', sa.String(36), nullable=False, primary_key=True),
        sa.Column('auth_id', sa.String(36), nullable=False),
        sa.Column('document_id', sa.String(255), nullable=False),
        sa.Column('document_name', sa.String(255)),
        sa.Column('book_id', sa.String(36), nullable=False),
        sa.Column('chapter_id', sa.String(36)),
        sa.Column('last_sync_at', sa.DateTime),
        sa.Column('last_edit_time', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['auth_id'], ['integration_auths.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_google_docs_syncs_auth_id', 'google_docs_syncs', ['auth_id'])
    op.create_index('ix_google_docs_syncs_book_id', 'google_docs_syncs', ['book_id'])
    
    # ZapierAction
    op.create_table(
        'zapier_actions',
        sa.Column('id', sa.String(36), nullable=False, primary_key=True),
        sa.Column('auth_id', sa.String(36), nullable=False),
        sa.Column('action_type', sa.String(100), nullable=False),
        sa.Column('action_data', sa.JSON),
        sa.Column('status', sa.String(50), default='pending'),
        sa.Column('result', sa.JSON),
        sa.Column('error_message', sa.Text),
        sa.Column('zap_id', sa.String(255)),
        sa.Column('executed_at', sa.DateTime, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['auth_id'], ['integration_auths.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_zapier_actions_auth_id', 'zapier_actions', ['auth_id'])
    
    # ExportTemplate
    op.create_table(
        'export_templates',
        sa.Column('id', sa.String(36), nullable=False, primary_key=True),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('format', sa.String(50)),
        sa.Column('includes', sa.JSON),
        sa.Column('filters', sa.JSON),
        sa.Column('webhook_trigger_enabled', sa.Integer, default=0),
        sa.Column('trigger_events', sa.JSON),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_export_templates_user_id', 'export_templates', ['user_id'])


def downgrade():
    """Drop API integration tables."""
    op.drop_table('export_templates')
    op.drop_table('zapier_actions')
    op.drop_table('google_docs_syncs')
    op.drop_table('notion_syncs')
    op.drop_table('integration_auths')
    op.drop_table('webhook_deliveries')
    op.drop_table('webhooks')
    op.drop_table('api_keys')
