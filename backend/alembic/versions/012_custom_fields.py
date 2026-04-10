"""Create custom_fields tables (P2.6)

Revision ID: 012_custom_fields
Revises: 011_bibliography
Create Date: 2026-04-10 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '012_custom_fields'
down_revision = '011_bibliography'
branch_labels = None
depends_on = None


def upgrade():
    # Create custom_fields table
    op.create_table(
        'custom_fields',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('book_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('field_type', sa.String(50), nullable=False),
        sa.Column('required', sa.Boolean(), default=False, nullable=False),
        sa.Column('default_value', postgresql.JSON(), nullable=True),
        sa.Column('options', postgresql.JSON(), nullable=True),
        sa.Column('order_index', sa.String(255), default='255', nullable=False),
        sa.Column('is_visible_in_list', sa.Boolean(), default=True, nullable=False),
        sa.Column('is_filterable', sa.Boolean(), default=True, nullable=False),
        sa.Column('metadata', postgresql.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_custom_fields_book_id'), 'custom_fields', ['book_id'], unique=False)

    # Create custom_field_values table
    op.create_table(
        'custom_field_values',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('custom_field_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('value', postgresql.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['custom_field_id'], ['custom_fields.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_custom_field_values_custom_field_id'), 'custom_field_values', ['custom_field_id'], unique=False)
    op.create_index(op.f('ix_custom_field_values_entity_id'), 'custom_field_values', ['entity_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_custom_field_values_entity_id'), table_name='custom_field_values')
    op.drop_index(op.f('ix_custom_field_values_custom_field_id'), table_name='custom_field_values')
    op.drop_table('custom_field_values')
    op.drop_index(op.f('ix_custom_fields_book_id'), table_name='custom_fields')
    op.drop_table('custom_fields')
