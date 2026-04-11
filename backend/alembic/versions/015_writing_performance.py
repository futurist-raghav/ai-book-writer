"""Migration: Add writing performance tracking tables for P7.1

Revision ID: 015
Revises: 014
Create Date: 2026-04-10
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create writing_sessions table
    op.create_table(
        'writing_sessions',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('book_id', sa.String(36), nullable=True),
        sa.Column('started_at', sa.DateTime, nullable=False),
        sa.Column('ended_at', sa.DateTime, nullable=True),
        sa.Column('words_written', sa.Integer, nullable=False, server_default='0'),
        sa.Column('words_deleted', sa.Integer, nullable=False, server_default='0'),
        sa.Column('net_words', sa.Integer, nullable=False, server_default='0'),
        sa.Column('characters_changed', sa.Integer, nullable=False, server_default='0'),
        sa.Column('session_type', sa.String(50), nullable=True),
        sa.Column('notes', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_writing_sessions_user_id', 'writing_sessions', ['user_id'])
    op.create_index('ix_writing_sessions_book_id', 'writing_sessions', ['book_id'])
    op.create_index('ix_writing_sessions_started_at', 'writing_sessions', ['started_at'])
    
    # Create writer_milestones table
    op.create_table(
        'writer_milestones',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('book_id', sa.String(36), nullable=True),
        sa.Column('milestone_type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('target_value', sa.Integer, nullable=True),
        sa.Column('current_value', sa.Integer, nullable=False, server_default='0'),
        sa.Column('progress_percent', sa.Integer, nullable=False, server_default='0'),
        sa.Column('unlocked_at', sa.DateTime, nullable=True),
        sa.Column('is_unlocked', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_writer_milestones_user_id', 'writer_milestones', ['user_id'])
    op.create_index('ix_writer_milestones_book_id', 'writer_milestones', ['book_id'])
    
    # Create writing_streaks table
    op.create_table(
        'writing_streaks',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('current_streak', sa.Integer, nullable=False, server_default='0'),
        sa.Column('longest_streak', sa.Integer, nullable=False, server_default='0'),
        sa.Column('last_written_at', sa.DateTime, nullable=True),
        sa.Column('total_days_written', sa.Integer, nullable=False, server_default='0'),
        sa.Column('total_words_written', sa.Integer, nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_user_writing_streak'),
    )
    op.create_index('ix_writing_streaks_user_id', 'writing_streaks', ['user_id'])
    
    # Create writing_challenges table
    op.create_table(
        'writing_challenges',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('book_id', sa.String(36), nullable=True),
        sa.Column('challenge_name', sa.String(255), nullable=False),
        sa.Column('challenge_type', sa.String(50), nullable=True),
        sa.Column('target_words', sa.Integer, nullable=False),
        sa.Column('current_words', sa.Integer, nullable=False, server_default='0'),
        sa.Column('progress_percent', sa.Integer, nullable=False, server_default='0'),
        sa.Column('started_at', sa.DateTime, nullable=False),
        sa.Column('ends_at', sa.DateTime, nullable=False),
        sa.Column('completed_at', sa.DateTime, nullable=True),
        sa.Column('is_active', sa.Integer, nullable=False, server_default='1'),
        sa.Column('is_completed', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_writing_challenges_user_id', 'writing_challenges', ['user_id'])
    op.create_index('ix_writing_challenges_book_id', 'writing_challenges', ['book_id'])
    op.create_index('ix_writing_challenges_is_active', 'writing_challenges', ['user_id', 'is_active'])


def downgrade() -> None:
    op.drop_index('ix_writing_challenges_is_active')
    op.drop_index('ix_writing_challenges_book_id')
    op.drop_index('ix_writing_challenges_user_id')
    op.drop_table('writing_challenges')
    
    op.drop_index('ix_writing_streaks_user_id')
    op.drop_table('writing_streaks')
    
    op.drop_index('ix_writer_milestones_book_id')
    op.drop_index('ix_writer_milestones_user_id')
    op.drop_table('writer_milestones')
    
    op.drop_index('ix_writing_sessions_started_at')
    op.drop_index('ix_writing_sessions_book_id')
    op.drop_index('ix_writing_sessions_user_id')
    op.drop_table('writing_sessions')
