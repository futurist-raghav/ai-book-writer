"""
Add project_type enum and make it required.

Revision ID: 004_project_type_sys
Revises: 003_project_chapter_meta
Create Date: 2026-04-09 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "004_project_type_sys"
down_revision = "003_project_chapter_meta"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add project_type system to books."""
    
    # Update existing books to have a project_type (default to 'novel')
    op.execute(
        """
        UPDATE books 
        SET project_type = 'novel' 
        WHERE project_type IS NULL
        """
    )
    
    # Make project_type NOT NULL
    op.alter_column(
        "books",
        "project_type",
        existing_type=sa.String(50),
        nullable=False,
        server_default="novel",
    )
    
    # Create an index on project_type for filtering
    op.create_index(
        "ix_books_project_type",
        "books",
        ["project_type"],
        unique=False,
    )


def downgrade() -> None:
    """Remove project_type system."""
    
    # Drop the index
    op.drop_index("ix_books_project_type", table_name="books")
    
    # Make project_type nullable again
    op.alter_column(
        "books",
        "project_type",
        existing_type=sa.String(50),
        nullable=True,
        server_default=None,
    )
