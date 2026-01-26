"""Initial migration with all models

Revision ID: 001_initial
Revises:
Create Date: 2024-01-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255)),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("is_verified", sa.Boolean(), default=False),
        sa.Column("writing_style", sa.String(50)),
        sa.Column("preferred_tense", sa.String(20)),
        sa.Column("preferred_perspective", sa.String(50)),
        sa.Column("writing_preferences", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Audio files table
    op.create_table(
        "audio_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("file_path", sa.String(512), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("mime_type", sa.String(100)),
        sa.Column("duration", sa.Float()),
        sa.Column("sample_rate", sa.Integer()),
        sa.Column("channels", sa.Integer()),
        sa.Column("status", sa.String(20), default="uploaded"),
        sa.Column("error_message", sa.Text()),
        sa.Column("file_metadata", postgresql.JSONB()),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_audio_files_user_id", "audio_files", ["user_id"])
    op.create_index("ix_audio_files_status", "audio_files", ["status"])

    # Transcriptions table
    op.create_table(
        "transcriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("segments", postgresql.JSONB()),
        sa.Column("words", postgresql.JSONB()),
        sa.Column("language", sa.String(10)),
        sa.Column("language_probability", sa.Float()),
        sa.Column("stt_service", sa.String(50)),
        sa.Column("stt_model", sa.String(100)),
        sa.Column("processing_time", sa.Float()),
        sa.Column("status", sa.String(20), default="pending"),
        sa.Column("error_message", sa.Text()),
        sa.Column("edit_history", postgresql.JSONB()),
        sa.Column("audio_file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("audio_files.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Events table
    op.create_table(
        "events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("summary", sa.Text()),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("original_text", sa.Text()),
        sa.Column("category", sa.String(100)),
        sa.Column("tags", postgresql.ARRAY(sa.String())),
        sa.Column("timeline_date", sa.Date()),
        sa.Column("timeline_period", sa.String(100)),
        sa.Column("location", sa.String(255)),
        sa.Column("people", postgresql.JSONB()),
        sa.Column("sentiment", sa.String(20)),
        sa.Column("emotions", postgresql.ARRAY(sa.String())),
        sa.Column("is_featured", sa.Boolean(), default=False),
        sa.Column("extraction_confidence", sa.Float()),
        sa.Column("extraction_model", sa.String(100)),
        sa.Column("extraction_metadata", postgresql.JSONB()),
        sa.Column("status", sa.String(20), default="extracted"),
        sa.Column("order_index", sa.Integer(), default=0),
        sa.Column("transcription_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("transcriptions.id", ondelete="SET NULL")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_events_user_id", "events", ["user_id"])
    op.create_index("ix_events_category", "events", ["category"])

    # Chapters table
    op.create_table(
        "chapters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("subtitle", sa.String(255)),
        sa.Column("chapter_number", sa.Integer(), nullable=False),
        sa.Column("synopsis", sa.Text()),
        sa.Column("compiled_content", sa.Text()),
        sa.Column("formatting_style", sa.String(50)),
        sa.Column("status", sa.String(20), default="draft"),
        sa.Column("compiled_at", sa.DateTime(timezone=True)),
        sa.Column("compile_model", sa.String(100)),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_chapters_user_id", "chapters", ["user_id"])

    # Chapter events association table
    op.create_table(
        "chapter_events",
        sa.Column("chapter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("chapters.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("events.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("order_index", sa.Integer(), default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Books table
    op.create_table(
        "books",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("subtitle", sa.String(255)),
        sa.Column("author_name", sa.String(255)),
        sa.Column("description", sa.Text()),
        sa.Column("genre", sa.String(100)),
        sa.Column("target_audience", sa.String(100)),
        sa.Column("dedication", sa.Text()),
        sa.Column("acknowledgments", sa.Text()),
        sa.Column("preface", sa.Text()),
        sa.Column("introduction", sa.Text()),
        sa.Column("epilogue", sa.Text()),
        sa.Column("afterword", sa.Text()),
        sa.Column("about_author", sa.Text()),
        sa.Column("status", sa.String(20), default="draft"),
        sa.Column("cover_image_path", sa.String(512)),
        sa.Column("last_exported_at", sa.DateTime(timezone=True)),
        sa.Column("last_export_format", sa.String(20)),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_books_user_id", "books", ["user_id"])

    # Book chapters association table
    op.create_table(
        "book_chapters",
        sa.Column("book_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("books.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("chapter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("chapters.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("order_index", sa.Integer(), default=0),
        sa.Column("part_number", sa.Integer()),
        sa.Column("part_title", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("book_chapters")
    op.drop_table("books")
    op.drop_table("chapter_events")
    op.drop_table("chapters")
    op.drop_table("events")
    op.drop_table("transcriptions")
    op.drop_table("audio_files")
    op.drop_table("users")
