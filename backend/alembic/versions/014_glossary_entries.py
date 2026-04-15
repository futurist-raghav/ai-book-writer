"""Migration: Add glossary tables for P3.8

Revision ID: 014
Revises: 013_import_sources
Create Date: 2026-04-10
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '014'
down_revision = '013_import_sources'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create glossary_entries table
    op.create_table(
        'glossary_entries',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('book_id', sa.String(36), nullable=False),
        sa.Column('term', sa.String(255), nullable=False),
        sa.Column('definition', sa.Text, nullable=True),
        sa.Column('definition_source', sa.String(500), nullable=True),  # where it was extracted from
        sa.Column('confirmed', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('part_of_speech', sa.String(50), nullable=True),  # noun, verb, adjective, etc.
        sa.Column('context', sa.Text, nullable=True),  # sample sentences where term appears
        sa.Column('frequency', sa.Integer, nullable=False, server_default='1'),
        sa.Column('chapter_mentions', sa.JSON, nullable=True),  # {"chapter_id": count}
        sa.Column('user_defined', sa.Boolean, nullable=False, server_default='false'),  # user added vs extracted
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('book_id', 'term', name='uq_book_glossary_term'),
    )
    
    # Create index for fast lookup
    op.create_index('ix_glossary_entries_book_id', 'glossary_entries', ['book_id'])
    op.create_index('ix_glossary_entries_confirmed', 'glossary_entries', ['book_id', 'confirmed'])


def downgrade() -> None:
    op.drop_index('ix_glossary_entries_confirmed')
    op.drop_index('ix_glossary_entries_book_id')
    op.drop_table('glossary_entries')
