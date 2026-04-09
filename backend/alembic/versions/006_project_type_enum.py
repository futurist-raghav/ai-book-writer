"""
Convert books.project_type to PostgreSQL enum.

Revision ID: 006_project_type_enum
Revises: 005_project_type_meta
Create Date: 2026-04-09 14:30:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "006_project_type_enum"
down_revision = "005_project_type_meta"
branch_labels = None
depends_on = None

PROJECT_TYPE_VALUES = (
    "novel",
    "memoir",
    "short_story_collection",
    "poetry_collection",
    "fanfiction",
    "interactive_fiction",
    "screenplay",
    "tv_series_bible",
    "graphic_novel_script",
    "comic_script",
    "songwriting_project",
    "podcast_script",
    "audiobook_script",
    "research_paper",
    "thesis_dissertation",
    "k12_textbook",
    "college_textbook",
    "academic_course",
    "technical_documentation",
    "business_book",
    "management_book",
    "self_help_book",
    "legal_document",
    "personal_journal",
    "experimental",
)


def upgrade() -> None:
    """Convert project_type from String to enum."""
    project_type_enum = postgresql.ENUM(*PROJECT_TYPE_VALUES, name="project_type_enum")
    project_type_enum.create(op.get_bind(), checkfirst=True)

    allowed_values_sql = ", ".join(f"'{value}'" for value in PROJECT_TYPE_VALUES)
    op.execute(
        f"""
        UPDATE books
        SET project_type = 'novel'
        WHERE project_type IS NULL OR project_type NOT IN ({allowed_values_sql})
        """
    )

    op.alter_column(
        "books",
        "project_type",
        existing_type=sa.String(length=50),
        type_=project_type_enum,
        nullable=False,
        server_default=sa.text("'novel'::project_type_enum"),
        postgresql_using="project_type::project_type_enum",
    )


def downgrade() -> None:
    """Convert project_type from enum back to String."""
    project_type_enum = postgresql.ENUM(*PROJECT_TYPE_VALUES, name="project_type_enum")

    op.alter_column(
        "books",
        "project_type",
        existing_type=project_type_enum,
        type_=sa.String(length=50),
        nullable=False,
        server_default=sa.text("'novel'"),
        postgresql_using="project_type::text",
    )

    project_type_enum.drop(op.get_bind(), checkfirst=True)
