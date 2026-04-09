"""Add chapter versions table for version snapshots and history.

Revision ID: 007
Revises: 006_project_type_enum
Create Date: 2026-04-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '007_chapter_versions'
down_revision = '006_project_type_enum'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create chapter_versions table
    op.create_table(
        'chapter_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chapter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('subtitle', sa.String(255), nullable=True),
        sa.Column('compiled_content', sa.Text, nullable=True),
        sa.Column('summary', sa.Text, nullable=True),
        sa.Column('word_count', sa.Integer(), nullable=True),
        sa.Column('chapter_number', sa.Integer(), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=True),
        sa.Column('chapter_type', sa.String(50), nullable=True),
        sa.Column('workflow_status', sa.String(50), nullable=True),
        sa.Column('version_name', sa.String(255), nullable=True),  # User-provided name like "Draft 1" or "Before major revision"
        sa.Column('change_description', sa.Text, nullable=True),  # What changed in this version
        sa.Column('is_auto_snapshot', sa.Boolean(), nullable=False, server_default='true'),  # Auto-created vs manual
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_chapter_versions_chapter_id', 'chapter_id'),
        sa.Index('ix_chapter_versions_user_id', 'user_id'),
        sa.Index('ix_chapter_versions_created_at', 'created_at'),
    )


def downgrade() -> None:
    op.drop_table('chapter_versions')
