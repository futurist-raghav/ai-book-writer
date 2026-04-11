"""Pydantic schemas for writing performance data."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class WritingSessionCreate(BaseModel):
    """Create writing session."""
    user_id: str
    book_id: Optional[str] = None
    session_type: str = "focused"  # 'focused', 'editing', 'brainstorm'
    notes: Optional[str] = None


class WritingSessionUpdate(BaseModel):
    """Update writing session."""
    ended_at: Optional[datetime] = None
    words_written: Optional[int] = None
    words_deleted: Optional[int] = None
    net_words: Optional[int] = None
    characters_changed: Optional[int] = None


class WritingSessionResponse(BaseModel):
    """Writing session response."""
    id: str
    user_id: str
    book_id: Optional[str]
    started_at: datetime
    ended_at: Optional[datetime]
    words_written: int
    words_deleted: int
    net_words: int
    session_type: str
    notes: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class WriterMilestoneResponse(BaseModel):
    """Writer milestone response."""
    id: str
    user_id: str
    book_id: Optional[str]
    milestone_type: str
    title: str
    description: Optional[str]
    target_value: Optional[int]
    current_value: int
    progress_percent: int
    is_unlocked: bool
    unlocked_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


class WritingStreakResponse(BaseModel):
    """Writing streak response."""
    id: str
    user_id: str
    current_streak: int
    longest_streak: int
    last_written_at: Optional[datetime]
    total_days_written: int
    total_words_written: int
    updated_at: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True


class WritingChallengeCreate(BaseModel):
    """Create writing challenge."""
    user_id: str
    book_id: Optional[str] = None
    challenge_name: str
    challenge_type: str = "custom"  # '30day', 'nanowrimo', 'custom'
    target_words: int
    started_at: datetime
    ends_at: datetime


class WritingChallengeResponse(BaseModel):
    """Writing challenge response."""
    id: str
    user_id: str
    book_id: Optional[str]
    challenge_name: str
    challenge_type: str
    target_words: int
    current_words: int
    progress_percent: int
    started_at: datetime
    ends_at: datetime
    completed_at: Optional[datetime]
    is_active: bool
    is_completed: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class WritingStatsResponse(BaseModel):
    """Aggregated writing statistics."""
    total_sessions: int
    total_words: int
    average_session_length: int
    current_streak: int
    longest_streak: int
    active_challenges: int
    unlocked_milestones: int
    last_session_at: Optional[datetime]
