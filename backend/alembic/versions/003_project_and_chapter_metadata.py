"""Add project and chapter metadata fields for editorial workflow

Revision ID: 003_project_chapter_meta
Revises: 002_ai_prefs_assets
Create Date: 2026-04-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "003_project_chapter_meta"
down_revision: Union[str, None] = "002_ai_prefs_assets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns(table_name)}
    return column_name in columns


def upgrade() -> None:
    if not _has_column("books", "project_type"):
        op.add_column("books", sa.Column("project_type", sa.String(length=50), nullable=True))
    if not _has_column("books", "cover_color"):
        op.add_column("books", sa.Column("cover_color", sa.String(length=32), nullable=True))
    if not _has_column("books", "target_word_count"):
        op.add_column("books", sa.Column("target_word_count", sa.Integer(), nullable=True))
    if not _has_column("books", "deadline_at"):
        op.add_column("books", sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=True))
    if not _has_column("books", "labels"):
        op.add_column(
            "books",
            sa.Column(
                "labels",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
                server_default=sa.text("'[]'::jsonb"),
            ),
        )
    if not _has_column("books", "is_pinned"):
        op.add_column(
            "books",
            sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        )

    if not _has_column("chapters", "chapter_type"):
        op.add_column(
            "chapters",
            sa.Column("chapter_type", sa.String(length=50), nullable=False, server_default="chapter"),
        )
    if not _has_column("chapters", "workflow_status"):
        op.add_column(
            "chapters",
            sa.Column("workflow_status", sa.String(length=20), nullable=False, server_default="draft"),
        )
    if not _has_column("chapters", "summary"):
        op.add_column("chapters", sa.Column("summary", sa.Text(), nullable=True))
    if not _has_column("chapters", "word_count_target"):
        op.add_column("chapters", sa.Column("word_count_target", sa.Integer(), nullable=True))
    if not _has_column("chapters", "timeline_position"):
        op.add_column("chapters", sa.Column("timeline_position", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("chapters", "timeline_position")
    op.drop_column("chapters", "word_count_target")
    op.drop_column("chapters", "summary")
    op.drop_column("chapters", "workflow_status")
    op.drop_column("chapters", "chapter_type")

    op.drop_column("books", "is_pinned")
    op.drop_column("books", "labels")
    op.drop_column("books", "deadline_at")
    op.drop_column("books", "target_word_count")
    op.drop_column("books", "cover_color")
    op.drop_column("books", "project_type")
