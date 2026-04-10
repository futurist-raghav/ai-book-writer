"""Flow Engine: Events, Timelines, and Dependencies (010)

Create tables for event management, timeline visualization, and dependency tracking.

Revision ID: 010_flow_engine
Revises: 009_entity_references
Create Date: 2026-04-10

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '010_flow_engine'
down_revision = '009_entity_references'
branch_labels = None
depends_on = None


def upgrade():
    """Create flow events, flow dependencies, and flow chapter events tables."""

    # Create flow_events table
    op.create_table(
        'flow_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('book_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('event_type', sa.String(50), nullable=False, server_default='beat'),  # scene, beat, milestone, act, chapter, subplot, branch, custom
        sa.Column('timeline_position', sa.Integer, nullable=False, server_default='0'),  # sortable position
        sa.Column('duration', sa.Integer, nullable=True),  # days/hours/minutes
        sa.Column('status', sa.String(50), nullable=False, server_default='planned'),  # planned, in_progress, completed, blocked
        sa.Column('order_index', sa.Integer, nullable=False, server_default='0'),
        sa.Column('metadata', postgresql.JSONB, nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('book_id', 'title', name='uq_flow_events_book_title'),
    )
    op.create_index('ix_flow_events_book_id', 'flow_events', ['book_id'])
    op.create_index('ix_flow_events_timeline_position', 'flow_events', ['timeline_position'])
    op.create_index('ix_flow_events_created_at', 'flow_events', ['created_at'])

    # Create flow_dependencies table
    op.create_table(
        'flow_dependencies',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('from_event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('to_event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('dependency_type', sa.String(50), nullable=False, server_default='blocks'),  # blocks, triggers, follows, required_before
        sa.Column('metadata', postgresql.JSONB, nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['from_event_id'], ['flow_events.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['to_event_id'], ['flow_events.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('from_event_id', 'to_event_id', name='uq_flow_dependencies'),
        sa.CheckConstraint('from_event_id != to_event_id', name='ck_no_self_dependencies'),
    )
    op.create_index('ix_flow_dependencies_from', 'flow_dependencies', ['from_event_id'])
    op.create_index('ix_flow_dependencies_to', 'flow_dependencies', ['to_event_id'])

    # Create flow_chapter_events table (association)
    op.create_table(
        'flow_chapter_events',
        sa.Column('chapter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('order_index', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['event_id'], ['flow_events.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('chapter_id', 'event_id', name='pk_flow_chapter_events'),
    )
    op.create_index('ix_flow_chapter_events_chapter', 'flow_chapter_events', ['chapter_id'])
    op.create_index('ix_flow_chapter_events_event', 'flow_chapter_events', ['event_id'])


def downgrade():
    """Drop flow engine tables."""
    op.drop_table('flow_chapter_events')
    op.drop_table('flow_dependencies')
    op.drop_table('flow_events')
