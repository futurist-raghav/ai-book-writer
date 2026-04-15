"""Add unified entity storage model

This migration creates a generic Entities table that replaces fragmented
entity storage (characters, world_entities) in project_settings JSON.

Revision ID: 008_unified_entity_model
Revises: 007_chapter_versions
Create Date: 2026-04-10

"""
from typing import Sequence, Union
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "008_unified_entity_model"
down_revision: Union[str, None] = "007_chapter_versions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create entity type enum
    entity_type_enum = postgresql.ENUM(
        'character', 'location', 'concept', 'faction', 'item', 'theme', 'custom',
        name='entity_type_enum',
        create_type=False
    )
    entity_type_enum.create(op.get_bind(), checkfirst=True)

    # Create Entities table
    op.create_table(
        'entities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column('book_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('books.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', entity_type_enum, nullable=False, server_default='character'),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(), default=dict, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_entities_book_id', 'entities', ['book_id'])
    op.create_index('ix_entities_book_type', 'entities', ['book_id', 'type'])
    op.create_index('ix_entities_name', 'entities', ['name'])

    # Migrate existing entities from project_settings
    # This is done via raw SQL to handle the JSON extraction efficiently
    migrate_sql = """
    INSERT INTO entities (book_id, type, name, description, metadata, created_at, updated_at)
    SELECT 
        b.id,
        'character'::entity_type_enum,
        char_data->>'name',
        char_data->>'description',
        char_data,
        COALESCE((char_data->>'created_at')::timestamp with time zone, NOW()),
        COALESCE((char_data->>'updated_at')::timestamp with time zone, NOW())
    FROM books b
    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(b.project_settings->'characters', '[]'::jsonb)
    ) AS char_data
    WHERE b.project_settings->'characters' IS NOT NULL
        AND jsonb_array_length(b.project_settings->'characters') > 0
    
    UNION ALL
    
    SELECT 
        b.id,
        CASE 
            WHEN world_data->>'type' = 'location' THEN 'location'::entity_type_enum
            ELSE 'concept'::entity_type_enum
        END,
        world_data->>'name',
        world_data->>'description',
        world_data,
        COALESCE((world_data->>'created_at')::timestamp with time zone, NOW()),
        COALESCE((world_data->>'updated_at')::timestamp with time zone, NOW())
    FROM books b
    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(b.project_settings->'world_entities', '[]'::jsonb)
    ) AS world_data
    WHERE b.project_settings->'world_entities' IS NOT NULL
        AND jsonb_array_length(b.project_settings->'world_entities') > 0;
    """
    op.execute(migrate_sql)


def downgrade() -> None:
    op.drop_index('ix_entities_name')
    op.drop_index('ix_entities_book_type')
    op.drop_index('ix_entities_book_id')
    op.drop_table('entities')
    op.execute('DROP TYPE entity_type_enum')
