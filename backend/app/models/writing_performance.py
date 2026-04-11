"""Writing performance and motivation tracking models."""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Float, JSON
from sqlalchemy.orm import relationship
from app.db import Base


class WritingSession(Base):
    """Tracked writing session."""
    
    __tablename__ = "writing_sessions"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    book_id = Column(String(36), ForeignKey("books.id"), nullable=True, index=True)
    
    # Session timing
    started_at = Column(DateTime, nullable=False, index=True)
    ended_at = Column(DateTime, nullable=True)
    
    # Performance metrics
    words_written = Column(Integer, default=0)
    words_deleted = Column(Integer, default=0)
    net_words = Column(Integer, default=0)
    characters_changed = Column(Integer, default=0)
    
    # Session data
    session_type = Column(String(50))  # 'focused', 'editing', 'brainstorm'
    notes = Column(String(255))
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    book = relationship("Book", foreign_keys=[book_id])


class WriterMilestone(Base):
    """Writing achievement/milestone."""
    
    __tablename__ = "writer_milestones"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    book_id = Column(String(36), ForeignKey("books.id"), nullable=True)
    
    # Milestone type
    milestone_type = Column(String(50), nullable=False)  # '1k_words', '5k_words', 'first_chapter', '7day_streak', 'finish_draft'
    title = Column(String(255), nullable=False)
    description = Column(String(500))
    
    # Progress
    target_value = Column(Integer)  # e.g., 1000 for 1k_words
    current_value = Column(Integer, default=0)
    progress_percent = Column(Integer, default=0)
    
    # Status
    unlocked_at = Column(DateTime)
    is_unlocked = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    book = relationship("Book", foreign_keys=[book_id])


class WritingStreak(Base):
    """Writing streak tracker."""
    
    __tablename__ = "writing_streaks"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Streak info
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    
    # Last writing
    last_written_at = Column(DateTime)
    
    # Stats
    total_days_written = Column(Integer, default=0)
    total_words_written = Column(Integer, default=0)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class WritingChallenge(Base):
    """Writing challenge (NaNoWriMo-style)."""
    
    __tablename__ = "writing_challenges"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    book_id = Column(String(36), ForeignKey("books.id"), nullable=True)
    
    # Challenge details
    challenge_name = Column(String(255), nullable=False)
    challenge_type = Column(String(50))  # '30day', 'nanowrimo', 'custom'
    
    # Goals
    target_words = Column(Integer, nullable=False)
    current_words = Column(Integer, default=0)
    progress_percent = Column(Integer, default=0)
    
    # Timing
    started_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime)
    
    # Status
    is_active = Column(Integer, default=1)
    is_completed = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    book = relationship("Book", foreign_keys=[book_id])
