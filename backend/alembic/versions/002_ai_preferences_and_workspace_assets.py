"""Add AI preference and workflow fields

Revision ID: 002_ai_preferences_and_workspace_assets
Revises: 001_initial
Create Date: 2026-04-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002_ai_prefs_assets"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("ai_assist_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.add_column("books", sa.Column("project_context", sa.Text(), nullable=True))
    op.add_column(
        "books",
        sa.Column(
            "project_settings",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column("books", sa.Column("default_writing_form", sa.String(length=50), nullable=True))
    op.add_column("books", sa.Column("default_chapter_tone", sa.String(length=50), nullable=True))
    op.add_column(
        "books",
        sa.Column("ai_enhancement_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.add_column("chapters", sa.Column("ai_enhancement_enabled", sa.Boolean(), nullable=True))

    op.add_column(
        "transcriptions",
        sa.Column("task_mode", sa.String(length=20), nullable=False, server_default="transcribe"),
    )
    op.add_column(
        "transcriptions",
        sa.Column("ai_enhanced", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("transcriptions", "ai_enhanced")
    op.drop_column("transcriptions", "task_mode")

    op.drop_column("chapters", "ai_enhancement_enabled")

    op.drop_column("books", "ai_enhancement_enabled")
    op.drop_column("books", "default_chapter_tone")
    op.drop_column("books", "default_writing_form")
    op.drop_column("books", "project_settings")
    op.drop_column("books", "project_context")

    op.drop_column("users", "ai_assist_enabled")
