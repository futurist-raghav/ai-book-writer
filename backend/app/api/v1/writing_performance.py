"""FastAPI routes for writing performance tracking."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.writing_performance import (
    WritingSessionCreate,
    WritingSessionUpdate,
    WritingSessionResponse,
    WritingStatsResponse,
    WritingChallengeCreate,
    WritingChallengeResponse,
)
from app.services.writing_performance import WritingPerformanceService


router = APIRouter(prefix="/writing", tags=["Writing Performance"])


@router.post("/sessions", response_model=WritingSessionResponse)
def start_writing_session(
    session_data: WritingSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a new writing session."""
    if session_data.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    session = WritingPerformanceService.create_session(db, session_data)
    return session


@router.patch("/sessions/{session_id}", response_model=WritingSessionResponse)
def end_writing_session(
    session_id: str,
    update_data: WritingSessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """End writing session and record metrics."""
    session = WritingPerformanceService.end_session(db, session_id, update_data)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    return session


@router.get("/stats", response_model=WritingStatsResponse)
def get_writing_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get writing statistics for current user."""
    stats = WritingPerformanceService.get_user_stats(db, current_user.id)
    return stats


@router.post("/challenges", response_model=WritingChallengeResponse)
def create_challenge(
    challenge_data: WritingChallengeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a writing challenge."""
    if challenge_data.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    challenge = WritingPerformanceService.create_challenge(db, challenge_data)
    return challenge


@router.patch("/challenges/{challenge_id}", response_model=WritingChallengeResponse)
def update_challenge(
    challenge_id: str,
    progress: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update challenge progress."""
    challenge = WritingPerformanceService.update_challenge_progress(
        db,
        challenge_id,
        progress.get("current_words", 0),
    )
    
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    if challenge.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    return challenge
