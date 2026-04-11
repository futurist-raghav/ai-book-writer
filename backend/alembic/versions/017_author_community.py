"""Migration: Add author community and networking for P7.3

Revision ID: 017
Revises: 016
Create Date: 2026-04-12
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '017'
down_revision = '016'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create author_profiles table
    op.create_table(
        'author_profiles',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('bio', sa.Text, nullable=True),
        sa.Column('website', sa.String(500), nullable=True),
        sa.Column('social_links', sa.JSON, nullable=False, server_default='{}'),
        sa.Column('visibility', sa.String(50), nullable=False, server_default='public'),
        sa.Column('allow_beta_requests', sa.Integer, nullable=False, server_default='1'),
        sa.Column('allow_messages', sa.Integer, nullable=False, server_default='1'),
        sa.Column('allow_collaboration_requests', sa.Integer, nullable=False, server_default='1'),
        sa.Column('published_books_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('total_readers', sa.Integer, nullable=False, server_default='0'),
        sa.Column('average_rating', sa.Float, nullable=False, server_default='0.0'),
        sa.Column('verified', sa.Integer, nullable=False, server_default='0'),
        sa.Column('featured', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_author_profiles_user_id'),
    )
    op.create_index('ix_author_profiles_user_id', 'author_profiles', ['user_id'])
    
    # Create beta_reader_profiles table
    op.create_table(
        'beta_reader_profiles',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('is_beta_reader', sa.Integer, nullable=False, server_default='0'),
        sa.Column('experience_level', sa.String(50), nullable=True),
        sa.Column('preferred_genres', sa.JSON, nullable=False, server_default='[]'),
        sa.Column('max_word_count', sa.Integer, nullable=False, server_default='100000'),
        sa.Column('current_requests', sa.Integer, nullable=False, server_default='0'),
        sa.Column('max_concurrent_books', sa.Integer, nullable=False, server_default='3'),
        sa.Column('avg_response_days', sa.Integer, nullable=False, server_default='14'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_beta_reader_user_id'),
    )
    op.create_index('ix_beta_reader_profiles_user_id', 'beta_reader_profiles', ['user_id'])
    
    # Create beta_reader_matches table
    op.create_table(
        'beta_reader_matches',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('book_id', sa.String(36), nullable=False),
        sa.Column('author_id', sa.String(36), nullable=False),
        sa.Column('beta_reader_id', sa.String(36), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='proposed'),
        sa.Column('compatibility_score', sa.Float, nullable=False, server_default='0.0'),
        sa.Column('feedback', sa.Text, nullable=True),
        sa.Column('overall_rating', sa.Integer, nullable=True),
        sa.Column('proposed_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('accepted_at', sa.DateTime, nullable=True),
        sa.Column('completed_at', sa.DateTime, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['beta_reader_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_beta_reader_matches_book_id', 'beta_reader_matches', ['book_id'])
    op.create_index('ix_beta_reader_matches_author_id', 'beta_reader_matches', ['author_id'])
    op.create_index('ix_beta_reader_matches_beta_reader_id', 'beta_reader_matches', ['beta_reader_id'])
    
    # Create writing_groups table
    op.create_table(
        'writing_groups',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('creator_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('visibility', sa.String(50), nullable=False, server_default='public'),
        sa.Column('member_count', sa.Integer, nullable=False, server_default='1'),
        sa.Column('requires_approval', sa.Integer, nullable=False, server_default='0'),
        sa.Column('focus_genres', sa.JSON, nullable=False, server_default='[]'),
        sa.Column('writing_stage', sa.JSON, nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug', name='uq_writing_groups_slug'),
    )
    op.create_index('ix_writing_groups_creator_id', 'writing_groups', ['creator_id'])
    
    # Create writing_group_members table
    op.create_table(
        'writing_group_members',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('group_id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='member'),
        sa.Column('status', sa.String(50), nullable=False, server_default='active'),
        sa.Column('post_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('joined_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('left_at', sa.DateTime, nullable=True),
        sa.ForeignKeyConstraint(['group_id'], ['writing_groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_writing_group_members_group_id', 'writing_group_members', ['group_id'])
    op.create_index('ix_writing_group_members_user_id', 'writing_group_members', ['user_id'])
    
    # Create author_messages table
    op.create_table(
        'author_messages',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('sender_id', sa.String(36), nullable=False),
        sa.Column('recipient_id', sa.String(36), nullable=False),
        sa.Column('subject', sa.String(255), nullable=True),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('is_read', sa.Integer, nullable=False, server_default='0'),
        sa.Column('is_archived', sa.Integer, nullable=False, server_default='0'),
        sa.Column('reply_to_id', sa.String(36), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now(), index=True),
        sa.Column('read_at', sa.DateTime, nullable=True),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recipient_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reply_to_id'], ['author_messages.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_author_messages_sender_id', 'author_messages', ['sender_id'])
    op.create_index('ix_author_messages_recipient_id', 'author_messages', ['recipient_id'])
    
    # Create public_author_pages table
    op.create_table(
        'public_author_pages',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('headline', sa.String(255), nullable=True),
        sa.Column('featured_bio', sa.Text, nullable=True),
        sa.Column('profile_image_url', sa.String(500), nullable=True),
        sa.Column('featured_books', sa.JSON, nullable=False, server_default='[]'),
        sa.Column('theme_color', sa.String(20), nullable=False, server_default='#000000'),
        sa.Column('banner_url', sa.String(500), nullable=True),
        sa.Column('page_views', sa.Integer, nullable=False, server_default='0'),
        sa.Column('click_throughs', sa.Integer, nullable=False, server_default='0'),
        sa.Column('is_published', sa.Integer, nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_public_author_pages_user_id'),
    )
    op.create_index('ix_public_author_pages_user_id', 'public_author_pages', ['user_id'])
    
    # Create author_collaborations table
    op.create_table(
        'author_collaborations',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('initiator_id', sa.String(36), nullable=False),
        sa.Column('collaborator_id', sa.String(36), nullable=False),
        sa.Column('book_id', sa.String(36), nullable=True),
        sa.Column('type', sa.String(50), nullable=True),
        sa.Column('message', sa.Text, nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='proposed'),
        sa.Column('proposed_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('accepted_at', sa.DateTime, nullable=True),
        sa.Column('completed_at', sa.DateTime, nullable=True),
        sa.ForeignKeyConstraint(['initiator_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['collaborator_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_author_collaborations_initiator_id', 'author_collaborations', ['initiator_id'])
    op.create_index('ix_author_collaborations_collaborator_id', 'author_collaborations', ['collaborator_id'])
    op.create_index('ix_author_collaborations_book_id', 'author_collaborations', ['book_id'])


def downgrade() -> None:
    op.drop_index('ix_author_collaborations_book_id')
    op.drop_index('ix_author_collaborations_collaborator_id')
    op.drop_index('ix_author_collaborations_initiator_id')
    op.drop_table('author_collaborations')
    
    op.drop_index('ix_public_author_pages_user_id')
    op.drop_table('public_author_pages')
    
    op.drop_index('ix_author_messages_recipient_id')
    op.drop_index('ix_author_messages_sender_id')
    op.drop_table('author_messages')
    
    op.drop_index('ix_writing_group_members_user_id')
    op.drop_index('ix_writing_group_members_group_id')
    op.drop_table('writing_group_members')
    
    op.drop_index('ix_writing_groups_creator_id')
    op.drop_table('writing_groups')
    
    op.drop_index('ix_beta_reader_matches_beta_reader_id')
    op.drop_index('ix_beta_reader_matches_author_id')
    op.drop_index('ix_beta_reader_matches_book_id')
    op.drop_table('beta_reader_matches')
    
    op.drop_index('ix_beta_reader_profiles_user_id')
    op.drop_table('beta_reader_profiles')
    
    op.drop_index('ix_author_profiles_user_id')
    op.drop_table('author_profiles')
