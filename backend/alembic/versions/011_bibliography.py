"""Bibliography and Citations (011)

Create tables for bibliography management and chapter citations.

Revision ID: 011_bibliography
Revises: 010_flow_engine
Create Date: 2026-04-10

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '011_bibliography'
down_revision = '010_flow_engine'
branch_labels = None
depends_on = None


def upgrade():
    """Create bibliography and chapter_citations tables."""

    # Create bibliography table
    op.create_table(
        'bibliography',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('book_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('authors', sa.JSON(), nullable=True),  # Array of author names
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('source_type', sa.String(50), nullable=True),  # book, article, website, video, etc.
        sa.Column('source_url', sa.String(2000), nullable=True),
        sa.Column('citation_formats', sa.JSON(), nullable=True),  # {apa: "...", mla: "...", chicago: "...", ieee: "..."}
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='CASCADE'),
        sa.Index('ix_bibliography_book_id', 'book_id'),
        sa.Index('ix_bibliography_title', 'title'),
    )

    # Create chapter_citations table (many-to-many with metadata)
    op.create_table(
        'chapter_citations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('chapter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('bibliography_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('page_number', sa.String(50), nullable=True),
        sa.Column('context_offset', sa.Integer(), nullable=True),  # Position in chapter text
        sa.Column('context_snippet', sa.Text(), nullable=True),  # Text around citation
        sa.Column('citation_format', sa.String(20), nullable=False, server_default='apa'),  # apa, mla, chicago, ieee
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['bibliography_id'], ['bibliography.id'], ondelete='CASCADE'),
        sa.Index('ix_chapter_citations_chapter_id', 'chapter_id'),
        sa.Index('ix_chapter_citations_bibliography_id', 'bibliography_id'),
    )


def downgrade():
    """Drop bibliography and chapter_citations tables."""
    op.drop_index('ix_chapter_citations_bibliography_id', table_name='chapter_citations')
    op.drop_index('ix_chapter_citations_chapter_id', table_name='chapter_citations')
    op.drop_table('chapter_citations')
    
    op.drop_index('ix_bibliography_title', table_name='bibliography')
    op.drop_index('ix_bibliography_book_id', table_name='bibliography')
    op.drop_table('bibliography')
