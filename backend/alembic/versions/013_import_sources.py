"""Create import_sources tables (P2.7)

Revision ID: 013_import_sources
Revises: 012_custom_fields
Create Date: 2026-04-10 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '013_import_sources'
down_revision = '012_custom_fields'
branch_labels = None
depends_on = None


def upgrade():
    # Create import_sources table
    op.create_table(
        'import_sources',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('book_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('format', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('total_characters', sa.Integer(), nullable=False),
        sa.Column('detected_structure', postgresql.JSON(), nullable=True),
        sa.Column('import_settings', postgresql.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_import_sources_book_id'), 'import_sources', ['book_id'], unique=False)
    op.create_index(op.f('ix_import_sources_status'), 'import_sources', ['status'], unique=False)

    # Create imported_content table
    op.create_table(
        'imported_content',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('import_source_id', sa.Integer(), nullable=False),
        sa.Column('section_index', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('content_type', sa.String(50), nullable=False),
        sa.Column('estimated_word_count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['import_source_id'], ['import_sources.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_imported_content_import_source_id'), 'imported_content', ['import_source_id'], unique=False)
    op.create_index('ix_imported_content_source_section', 'imported_content', ['import_source_id', 'section_index'], unique=True)


def downgrade():
    op.drop_index('ix_imported_content_source_section', table_name='imported_content')
    op.drop_index(op.f('ix_imported_content_import_source_id'), table_name='imported_content')
    op.drop_table('imported_content')
    op.drop_index(op.f('ix_import_sources_status'), table_name='import_sources')
    op.drop_index(op.f('ix_import_sources_book_id'), table_name='import_sources')
    op.drop_table('import_sources')
