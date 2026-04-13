"""Mobile app models for iOS/Android."""

from typing import TYPE_CHECKING, Optional

from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, Boolean, JSON, Text, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base


class MobileSession(Base):
    """Mobile app session tracking."""
    
    __tablename__ = "mobile_sessions"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Session info
    device_id: Mapped[str] = mapped_column(String(255), nullable=False)
    device_type: Mapped[str] = mapped_column(String(50)) # ios, android
    device_model: Mapped[str] = mapped_column(String(255))
    app_version: Mapped[str] = mapped_column(String(50))
    
    # Status
    is_active: Mapped[int] = mapped_column(Integer, default=1)
    
    # Tracking
    last_activity_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    push_token: Mapped[Optional[str]] = mapped_column(String(500), nullable=True) # For push notifications
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class OfflineDraft(Base):
    """Offline editing draft synced when online."""
    
    __tablename__ = "offline_drafts"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Content
    chapter_id: Mapped[str] = mapped_column(String(36), ForeignKey("chapters.id"), nullable=False)
    book_id: Mapped[str] = mapped_column(String(36), ForeignKey("books.id"), nullable=False)
    
    # Local content
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_synced_version: Mapped[int] = mapped_column(Integer, default=0)
    local_version: Mapped[int] = mapped_column(Integer, default=1)
    
    # Sync status
    sync_status: Mapped[str] = mapped_column(String(50), default="pending") # pending, synced, conflicted
    conflict_resolution: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # local, remote, merged
    
    # Device info
    device_id: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    chapter = relationship("Chapter", foreign_keys=[chapter_id])
    book = relationship("Book", foreign_keys=[book_id])


class MobileNotification(Base):
    """Push notifications for mobile app."""
    
    __tablename__ = "mobile_notifications"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Content
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(100)) # feedback_received, collaboration_invited, etc
    
    # Data
    data: Mapped[dict] = mapped_column(JSON, default={})
    deep_link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True) # /chapter/123/comments
    
    # Status
    is_sent: Mapped[int] = mapped_column(Integer, default=0)
    is_read: Mapped[int] = mapped_column(Integer, default=0)
    
    # Badge counter
    badge_count: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class VoiceNote(Base):
    """Voice-to-text note for mobile app."""
    
    __tablename__ = "voice_notes"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Reference
    book_id: Mapped[str] = mapped_column(String(36), ForeignKey("books.id"), nullable=False)
    chapter_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("chapters.id"), nullable=True)
    
    # Content
    audio_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True) # Cloud storage URL
    audio_duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    transcription: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    transcription_status: Mapped[str] = mapped_column(String(50), default="pending") # pending, processing, completed, failed
    
    # Quality
    transcription_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    language: Mapped[str] = mapped_column(String(10), default="en")
    
    # Usage
    is_converted_to_text: Mapped[int] = mapped_column(Integer, default=0)
    converted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    book = relationship("Book", foreign_keys=[book_id])
    chapter = relationship("Chapter", foreign_keys=[chapter_id])


class ReadingMode(Base):
    """Reading mode cache for mobile (lightweight book view)."""
    
    __tablename__ = "reading_modes"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    book_id: Mapped[str] = mapped_column(String(36), ForeignKey("books.id"), nullable=False, unique=True)
    
    # Preferences
    font_size: Mapped[int] = mapped_column(Integer, default=16) # points
    font_family: Mapped[str] = mapped_column(String(50), default="system") # system, serif, monospace
    line_height: Mapped[float] = mapped_column(Float, default=1.5)
    theme: Mapped[str] = mapped_column(String(50), default="light") # light, dark, sepia
    
    # Content state
    current_chapter_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    current_position_percent: Mapped[float] = mapped_column(Float, default=0.0)
    last_read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Accessibility
    text_alignment: Mapped[str] = mapped_column(String(50), default="left")
    letter_spacing: Mapped[float] = mapped_column(Float, default=0.0)
    paragraph_spacing: Mapped[float] = mapped_column(Float, default=1.0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    book = relationship("Book", foreign_keys=[book_id])


class AppAnalytics(Base):
    """Mobile app usage analytics."""
    
    __tablename__ = "app_analytics"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    device_id: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Session metrics
    session_duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    pages_viewed: Mapped[int] = mapped_column(Integer, default=0)
    actions_taken: Mapped[int] = mapped_column(Integer, default=0)
    
    # Writing metrics
    characters_added: Mapped[int] = mapped_column(Integer, default=0)
    characters_deleted: Mapped[int] = mapped_column(Integer, default=0)
    time_writing: Mapped[int] = mapped_column(Integer, default=0) # seconds
    
    # Feature usage
    features_used: Mapped[dict] = mapped_column(JSON, default=[]) # [writing, reading, feedback, etc]
    
    # Engagement
    crash_count: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
