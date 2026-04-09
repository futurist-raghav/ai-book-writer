"""
Add metadata JSONB column for project type-specific settings.

Revision ID: 005_project_type_meta
Revises: 004_project_type_sys
Create Date: 2026-04-10 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "005_project_type_meta"
down_revision = "004_project_type_sys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add metadata JSONB column to books."""
    
    # Add metadata column for type-specific settings
    op.add_column(
        "books",
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default="{}",
        ),
    )


def downgrade() -> None:
    """Remove metadata column from books."""
    op.drop_column("books", "metadata")
