"""Add missing user account columns

Revision ID: 022_user_account_columns
Revises: 021_enterprise
Create Date: 2026-04-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "022_user_account_columns"
down_revision: Union[str, None] = "021_enterprise"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns(table_name)}
    return column_name in columns


def upgrade() -> None:
    if not _has_column("users", "ai_assist_enabled"):
        op.add_column(
            "users",
            sa.Column(
                "ai_assist_enabled",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            ),
        )

    if not _has_column("users", "is_superuser"):
        op.add_column(
            "users",
            sa.Column(
                "is_superuser",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )

    if not _has_column("users", "custom_api_keys"):
        op.add_column(
            "users",
            sa.Column(
                "custom_api_keys",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
                server_default=sa.text("'{}'::jsonb"),
            ),
        )

    if not _has_column("users", "last_login"):
        op.add_column(
            "users",
            sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    if _has_column("users", "last_login"):
        op.drop_column("users", "last_login")

    if _has_column("users", "custom_api_keys"):
        op.drop_column("users", "custom_api_keys")

    if _has_column("users", "is_superuser"):
        op.drop_column("users", "is_superuser")

    if _has_column("users", "ai_assist_enabled"):
        op.drop_column("users", "ai_assist_enabled")
