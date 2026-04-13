"""Writing performance and motivation tracking models."""

from typing import TYPE_CHECKING, Optional

from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, Float, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base


class WritingSession(Base):
    """Tracked writing session."""
    
    __tablename__ = "writing_sessions"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    book_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("books.id"), nullable=True, index=True)
    
    # Session timing
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Performance metrics
    words_written: Mapped[int] = mapped_column(Integer, default=0)
    words_deleted: Mapped[int] = mapped_column(Integer, default=0)
    net_words: Mapped[int] = mapped_column(Integer, default=0)
    characters_changed: Mapped[int] = mapped_column(Integer, default=0)
    
    # Session data
    session_type: Mapped[str] = mapped_column(String(50)) # 'focused', 'editing', 'brainstorm'
    notes: Mapped[str] = mapped_column(String(255))
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    book = relationship("Book", foreign_keys=[book_id])


class WriterMilestone(Base):
    """Writing achievement/milestone."""
    
    __tablename__ = "writer_milestones"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    book_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("books.id"), nullable=True)
    
    # Milestone type
    milestone_type: Mapped[str] = mapped_column(String(50), nullable=False) # '1k_words', '5k_words', 'first_chapter', '7day_streak', 'finish_draft'
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(500))
    
    # Progress
    target_value: Mapped[int] = mapped_column(Integer) # e.g., 1000 for 1k_words
    current_value: Mapped[int] = mapped_column(Integer, default=0)
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    
    # Status
    unlocked_at: Mapped[datetime] = mapped_column(DateTime)
    is_unlocked: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    book = relationship("Book", foreign_keys=[book_id])


class WritingStreak(Base):
    """Writing streak tracker."""
    
    __tablename__ = "writing_streaks"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Streak info
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    
    # Last writing
    last_written_at: Mapped[datetime] = mapped_column(DateTime)
    
    # Stats
    total_days_written: Mapped[int] = mapped_column(Integer, default=0)
    total_words_written: Mapped[int] = mapped_column(Integer, default=0)
    
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class WritingChallenge(Base):
    """Writing challenge (NaNoWriMo-style)."""
    
    __tablename__ = "writing_challenges"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    book_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("books.id"), nullable=True)
    
    # Challenge details
    challenge_name: Mapped[str] = mapped_column(String(255), nullable=False)
    challenge_type: Mapped[str] = mapped_column(String(50)) # '30day', 'nanowrimo', 'custom'
    
    # Goals
    target_words: Mapped[int] = mapped_column(Integer, nullable=False)
    current_words: Mapped[int] = mapped_column(Integer, default=0)
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    
    # Timing
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime)
    
    # Status
    is_active: Mapped[int] = mapped_column(Integer, default=1)
    is_completed: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    book = relationship("Book", foreign_keys=[book_id])
