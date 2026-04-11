"""Mobile app models for iOS/Android."""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Boolean, JSON, Text
from sqlalchemy.orm import relationship
from app.db import Base


class MobileSession(Base):
    """Mobile app session tracking."""
    
    __tablename__ = "mobile_sessions"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Session info
    device_id = Column(String(255), nullable=False)
    device_type = Column(String(50))  # ios, android
    device_model = Column(String(255))
    app_version = Column(String(50))
    
    # Status
    is_active = Column(Integer, default=1)
    
    # Tracking
    last_activity_at = Column(DateTime, default=datetime.utcnow)
    push_token = Column(String(500), nullable=True)  # For push notifications
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class OfflineDraft(Base):
    """Offline editing draft synced when online."""
    
    __tablename__ = "offline_drafts"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Content
    chapter_id = Column(String(36), ForeignKey("chapters.id"), nullable=False)
    book_id = Column(String(36), ForeignKey("books.id"), nullable=False)
    
    # Local content
    content = Column(Text, nullable=True)
    last_synced_version = Column(Integer, default=0)
    local_version = Column(Integer, default=1)
    
    # Sync status
    sync_status = Column(String(50), default="pending")  # pending, synced, conflicted
    conflict_resolution = Column(String(50), nullable=True)  # local, remote, merged
    
    # Device info
    device_id = Column(String(255), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    chapter = relationship("Chapter", foreign_keys=[chapter_id])
    book = relationship("Book", foreign_keys=[book_id])


class MobileNotification(Base):
    """Push notifications for mobile app."""
    
    __tablename__ = "mobile_notifications"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Content
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    notification_type = Column(String(100))  # feedback_received, collaboration_invited, etc
    
    # Data
    data = Column(JSON, default={})
    deep_link = Column(String(500), nullable=True)  # /chapter/123/comments
    
    # Status
    is_sent = Column(Integer, default=0)
    is_read = Column(Integer, default=0)
    
    # Badge counter
    badge_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class VoiceNote(Base):
    """Voice-to-text note for mobile app."""
    
    __tablename__ = "voice_notes"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Reference
    book_id = Column(String(36), ForeignKey("books.id"), nullable=False)
    chapter_id = Column(String(36), ForeignKey("chapters.id"), nullable=True)
    
    # Content
    audio_url = Column(String(500), nullable=True)  # Cloud storage URL
    audio_duration_seconds = Column(Integer, nullable=True)
    transcription = Column(Text, nullable=True)
    transcription_status = Column(String(50), default="pending")  # pending, processing, completed, failed
    
    # Quality
    transcription_confidence = Column(float, default=0.0)
    language = Column(String(10), default="en")
    
    # Usage
    is_converted_to_text = Column(Integer, default=0)
    converted_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    book = relationship("Book", foreign_keys=[book_id])
    chapter = relationship("Chapter", foreign_keys=[chapter_id])


class ReadingMode(Base):
    """Reading mode cache for mobile (lightweight book view)."""
    
    __tablename__ = "reading_modes"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    book_id = Column(String(36), ForeignKey("books.id"), nullable=False, unique=True)
    
    # Preferences
    font_size = Column(Integer, default=16)  # points
    font_family = Column(String(50), default="system")  # system, serif, monospace
    line_height = Column(float, default=1.5)
    theme = Column(String(50), default="light")  # light, dark, sepia
    
    # Content state
    current_chapter_id = Column(String(36), nullable=True)
    current_position_percent = Column(float, default=0.0)
    last_read_at = Column(DateTime, nullable=True)
    
    # Accessibility
    text_alignment = Column(String(50), default="left")
    letter_spacing = Column(float, default=0.0)
    paragraph_spacing = Column(float, default=1.0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    book = relationship("Book", foreign_keys=[book_id])


class AppAnalytics(Base):
    """Mobile app usage analytics."""
    
    __tablename__ = "app_analytics"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    device_id = Column(String(255), nullable=False)
    
    # Session metrics
    session_duration_seconds = Column(Integer, default=0)
    pages_viewed = Column(Integer, default=0)
    actions_taken = Column(Integer, default=0)
    
    # Writing metrics
    characters_added = Column(Integer, default=0)
    characters_deleted = Column(Integer, default=0)
    time_writing = Column(Integer, default=0)  # seconds
    
    # Feature usage
    features_used = Column(JSON, default=[])  # [writing, reading, feedback, etc]
    
    # Engagement
    crash_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    
    recorded_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
