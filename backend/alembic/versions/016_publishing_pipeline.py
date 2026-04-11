"""Migration: Add advanced publishing pipeline for P7.2

Revision ID: 016
Revises: 015
Create Date: 2026-04-12
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '016'
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create publishing_profiles table
    op.create_table(
        'publishing_profiles',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('book_id', sa.String(36), nullable=False),
        sa.Column('isbn', sa.String(20), nullable=True),
        sa.Column('international_isbn', sa.String(20), nullable=True),
        sa.Column('publisher_name', sa.String(255), nullable=True),
        sa.Column('imprint', sa.String(255), nullable=True),
        sa.Column('edition', sa.String(50), nullable=False, server_default='1st Edition'),
        sa.Column('publication_date', sa.DateTime, nullable=True),
        sa.Column('copyright_year', sa.Integer, nullable=True),
        sa.Column('primary_channel', sa.String(50), nullable=False, server_default='direct'),
        sa.Column('distribution_channels', sa.JSON, nullable=False, server_default='[]'),
        sa.Column('ebook_price_cents', sa.Integer, nullable=True),
        sa.Column('paperback_price_cents', sa.Integer, nullable=True),
        sa.Column('hardcover_price_cents', sa.Integer, nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='draft'),
        sa.Column('is_published', sa.Integer, nullable=False, server_default='0'),
        sa.Column('visibility', sa.String(50), nullable=False, server_default='private'),
        sa.Column('book_index_enabled', sa.Integer, nullable=False, server_default='1'),
        sa.Column('table_of_contents_enabled', sa.Integer, nullable=False, server_default='1'),
        sa.Column('digital_rights_management', sa.Integer, nullable=False, server_default='0'),
        sa.Column('allow_downloads', sa.Integer, nullable=False, server_default='1'),
        sa.Column('metadata_settings', sa.JSON, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('published_at', sa.DateTime, nullable=True),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('book_id', name='uq_book_publishing_profile'),
        sa.UniqueConstraint('isbn', name='uq_publishing_isbn'),
    )
    op.create_index('ix_publishing_profiles_book_id', 'publishing_profiles', ['book_id'])
    op.create_index('ix_publishing_profiles_isbn', 'publishing_profiles', ['isbn'])
    
    # Create publishing_queue table
    op.create_table(
        'publishing_queue',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('book_id', sa.String(36), nullable=False),
        sa.Column('channel', sa.String(50), nullable=False),
        sa.Column('format_type', sa.String(50), nullable=False),
        sa.Column('scheduled_date', sa.DateTime, nullable=True),
        sa.Column('queued_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime, nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('job_id', sa.String(200), nullable=True),
        sa.Column('retry_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_publishing_queue_book_id', 'publishing_queue', ['book_id'])
    op.create_index('ix_publishing_queue_status', 'publishing_queue', ['status'])
    op.create_index('ix_publishing_queue_queued_at', 'publishing_queue', ['queued_at'])
    
    # Create publishing_metrics table
    op.create_table(
        'publishing_metrics',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('book_id', sa.String(36), nullable=False),
        sa.Column('total_sales', sa.Integer, nullable=False, server_default='0'),
        sa.Column('total_revenue_cents', sa.Integer, nullable=False, server_default='0'),
        sa.Column('amazon_sales', sa.Integer, nullable=False, server_default='0'),
        sa.Column('amazon_revenue_cents', sa.Integer, nullable=False, server_default='0'),
        sa.Column('ingramspark_sales', sa.Integer, nullable=False, server_default='0'),
        sa.Column('ingramspark_revenue_cents', sa.Integer, nullable=False, server_default='0'),
        sa.Column('total_downloads', sa.Integer, nullable=False, server_default='0'),
        sa.Column('ebook_downloads', sa.Integer, nullable=False, server_default='0'),
        sa.Column('average_rating', sa.Integer, nullable=False, server_default='0'),
        sa.Column('review_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('page_views', sa.Integer, nullable=False, server_default='0'),
        sa.Column('shares', sa.Integer, nullable=False, server_default='0'),
        sa.Column('last_sync_at', sa.DateTime, nullable=True),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('book_id', name='uq_book_publishing_metrics'),
    )
    op.create_index('ix_publishing_metrics_book_id', 'publishing_metrics', ['book_id'])
    
    # Create isbn_requests table
    op.create_table(
        'isbn_requests',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('book_id', sa.String(36), nullable=False),
        sa.Column('isbn_10', sa.String(20), nullable=True),
        sa.Column('isbn_13', sa.String(20), nullable=True),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('requested_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('assigned_at', sa.DateTime, nullable=True),
        sa.Column('activated_at', sa.DateTime, nullable=True),
        sa.Column('expires_at', sa.DateTime, nullable=True),
        sa.Column('cost_cents', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('isbn_10', name='uq_isbn_10'),
        sa.UniqueConstraint('isbn_13', name='uq_isbn_13'),
    )
    op.create_index('ix_isbn_requests_book_id', 'isbn_requests', ['book_id'])
    op.create_index('ix_isbn_requests_status', 'isbn_requests', ['status'])


def downgrade() -> None:
    op.drop_index('ix_isbn_requests_status')
    op.drop_index('ix_isbn_requests_book_id')
    op.drop_table('isbn_requests')
    
    op.drop_index('ix_publishing_metrics_book_id')
    op.drop_table('publishing_metrics')
    
    op.drop_index('ix_publishing_queue_queued_at')
    op.drop_index('ix_publishing_queue_status')
    op.drop_index('ix_publishing_queue_book_id')
    op.drop_table('publishing_queue')
    
    op.drop_index('ix_publishing_profiles_isbn')
    op.drop_index('ix_publishing_profiles_book_id')
    op.drop_table('publishing_profiles')
