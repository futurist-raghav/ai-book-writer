"""P7.6 Mobile Apps - sessions, offline drafts, notifications, voice notes, reading mode, analytics.

Revision ID: 020
Revises: 019_api_integrations
Create Date: 2024-01-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from uuid import uuid4
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '020'
down_revision = '019_api_integrations'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create mobile app tables: sessions, drafts, notifications, voice notes, reading mode, analytics."""
    
    # === MOBILE SESSIONS ===
    op.create_table(
        'mobile_sessions',
        sa.Column('id', sa.String(36), primary_key=True, default=lambda: str(uuid4())),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('device_id', sa.String(256), nullable=False),
        sa.Column('device_type', sa.String(20), nullable=False),  # ios, android
        sa.Column('app_version', sa.String(20), nullable=False),
        sa.Column('os_version', sa.String(20), nullable=True),
        sa.Column('push_token', sa.Text, nullable=True),
        sa.Column('is_active', sa.Boolean, default=True, nullable=False),
        sa.Column('last_activity_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('user_id', 'device_id', name='uq_sessions_user_device'),
        sa.Index('idx_sessions_user_id', 'user_id'),
        sa.Index('idx_sessions_device_id', 'device_id'),
        sa.Index('idx_sessions_is_active', 'is_active'),
    )
    
    # === OFFLINE DRAFTS ===
    op.create_table(
        'offline_drafts',
        sa.Column('id', sa.String(36), primary_key=True, default=lambda: str(uuid4())),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('book_id', sa.String(36), sa.ForeignKey('books.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chapter_id', sa.String(36), sa.ForeignKey('chapters.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('device_id', sa.String(256), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('local_version', sa.Integer, default=1, nullable=False),
        sa.Column('sync_status', sa.String(20), default='pending', nullable=False),  # pending, synced, conflicted
        sa.Column('synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('user_id', 'chapter_id', 'device_id', name='uq_drafts_user_chapter_device'),
        sa.Index('idx_drafts_user_id', 'user_id'),
        sa.Index('idx_drafts_sync_status', 'sync_status'),
        sa.Index('idx_drafts_chapter_id', 'chapter_id'),
    )
    
    # === MOBILE NOTIFICATIONS ===
    op.create_table(
        'mobile_notifications',
        sa.Column('id', sa.String(36), primary_key=True, default=lambda: str(uuid4())),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('title', sa.String(256), nullable=False),
        sa.Column('body', sa.Text, nullable=False),
        sa.Column('data', postgresql.JSON, nullable=True),
        sa.Column('deep_link', sa.String(512), nullable=True),
        sa.Column('event_type', sa.String(50), nullable=True),
        sa.Column('is_read', sa.Boolean, default=False, nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Index('idx_notifications_user_id', 'user_id'),
        sa.Index('idx_notifications_is_read', 'is_read'),
        sa.Index('idx_notifications_created_at', 'created_at'),
    )
    
    # === VOICE NOTES ===
    op.create_table(
        'voice_notes',
        sa.Column('id', sa.String(36), primary_key=True, default=lambda: str(uuid4())),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('book_id', sa.String(36), sa.ForeignKey('books.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chapter_id', sa.String(36), sa.ForeignKey('chapters.id', ondelete='SET NULL'), nullable=True),
        sa.Column('audio_url', sa.String(512), nullable=False),
        sa.Column('audio_duration_seconds', sa.Integer, nullable=False),
        sa.Column('transcription', sa.Text, nullable=True),
        sa.Column('transcription_status', sa.String(20), default='pending', nullable=False),  # pending, processing, completed, failed
        sa.Column('transcription_confidence', sa.Float, nullable=True),
        sa.Column('language', sa.String(20), default='en', nullable=False),
        sa.Column('is_converted_to_text', sa.Boolean, default=False, nullable=False),
        sa.Column('converted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Index('idx_voice_notes_user_id', 'user_id'),
        sa.Index('idx_voice_notes_chapter_id', 'chapter_id'),
        sa.Index('idx_voice_notes_status', 'transcription_status'),
    )
    
    # === READING MODE ===
    op.create_table(
        'reading_modes',
        sa.Column('id', sa.String(36), primary_key=True, default=lambda: str(uuid4())),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('book_id', sa.String(36), sa.ForeignKey('books.id', ondelete='CASCADE'), nullable=False),
        sa.Column('font_size', sa.Float, default=16.0, nullable=False),
        sa.Column('font_family', sa.String(50), default='system', nullable=False),
        sa.Column('line_height', sa.Float, default=1.5, nullable=False),
        sa.Column('theme', sa.String(20), default='light', nullable=False),  # light, dark, sepia
        sa.Column('current_chapter_id', sa.String(36), sa.ForeignKey('chapters.id', ondelete='SET NULL'), nullable=True),
        sa.Column('current_position_percent', sa.Float, default=0.0, nullable=False),
        sa.Column('bookmarks', postgresql.JSON, nullable=True),
        sa.Column('last_read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('user_id', 'book_id', name='uq_reading_mode_user_book'),
        sa.Index('idx_reading_mode_user_id', 'user_id'),
        sa.Index('idx_reading_mode_book_id', 'book_id'),
    )
    
    # === APP ANALYTICS ===
    op.create_table(
        'app_analytics',
        sa.Column('id', sa.String(36), primary_key=True, default=lambda: str(uuid4())),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('device_id', sa.String(256), nullable=False),
        sa.Column('event_name', sa.String(100), nullable=False),
        sa.Column('event_data', postgresql.JSON, nullable=True),
        sa.Column('session_duration_seconds', sa.Integer, nullable=True),
        sa.Column('pages_viewed', sa.Integer, default=0, nullable=False),
        sa.Column('characters_added', sa.Integer, default=0, nullable=False),
        sa.Column('characters_deleted', sa.Integer, default=0, nullable=False),
        sa.Column('words_written', sa.Integer, default=0, nullable=False),
        sa.Column('voice_notes_created', sa.Integer, default=0, nullable=False),
        sa.Column('features_used', postgresql.JSON, nullable=True),
        sa.Column('crashes_count', sa.Integer, default=0, nullable=False),
        sa.Column('errors_count', sa.Integer, default=0, nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Index('idx_analytics_user_id', 'user_id'),
        sa.Index('idx_analytics_event_name', 'event_name'),
        sa.Index('idx_analytics_timestamp', 'timestamp'),
    )


def downgrade() -> None:
    """Drop mobile app tables."""
    op.drop_table('app_analytics')
    op.drop_table('reading_modes')
    op.drop_table('voice_notes')
    op.drop_table('mobile_notifications')
    op.drop_table('offline_drafts')
    op.drop_table('mobile_sessions')
