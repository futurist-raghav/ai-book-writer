"""Add entity_references table for cross-reference tracking

This migration creates an entity_references table that tracks which chapters
mention which entities, enabling cross-reference queries and entity usage analytics.

Revision ID: 009_entity_references
Revises: 008_unified_entity_model
Create Date: 2026-04-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "009_entity_references"
down_revision: Union[str, None] = "008_unified_entity_model"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create entity_references table
    op.create_table(
        'entity_references',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('entities.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chapter_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('chapters.id', ondelete='CASCADE'), nullable=False),
        sa.Column('mention_count', sa.Integer(), default=1, nullable=False),
        sa.Column('first_mention_position', sa.Integer(), nullable=True, doc="Character position of first mention in chapter"),
        sa.Column('context_snippet', sa.Text(), nullable=True, doc="Text snippet showing entity mention context"),
        sa.Column('extraction_metadata', postgresql.JSONB(), default=dict, nullable=True, doc="Metadata from extraction (confidence, tags, etc.)"),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Create indexes for common lookup patterns
    op.create_index('ix_entity_references_entity_id', 'entity_references', ['entity_id'])
    op.create_index('ix_entity_references_chapter_id', 'entity_references', ['chapter_id'])
    
    # Add unique constraint to prevent duplicate entity-chapter references
    op.create_unique_constraint(
        'uq_entity_references_entity_chapter',
        'entity_references',
        ['entity_id', 'chapter_id']
    )


def downgrade() -> None:
    op.drop_constraint('uq_entity_references_entity_chapter', 'entity_references')
    op.drop_index('ix_entity_references_chapter_id')
    op.drop_index('ix_entity_references_entity_id')
    op.drop_table('entity_references')
