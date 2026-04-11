"""FastAPI routes for writing performance tracking."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from app.db import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.writing_performance import WritingSession
from app.schemas.writing_performance import (
    WritingSessionCreate,
    WritingSessionUpdate,
    WritingSessionResponse,
    WriterMilestoneResponse,
    WritingStreakResponse,
    WritingStatsResponse,
    WritingChallengeCreate,
    WritingChallengeResponse,
)
from app.services.writing_performance import WritingPerformanceService
from typing import List


router = APIRouter(prefix="/api/v1/writing", tags=["writing"])


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


@router.get("/heatmap")
def get_writing_heatmap(
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get writing heatmap data (busiest writing hours/days)."""
    # Calculate date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Query sessions in date range
    sessions = db.query(WritingSession).filter(
        and_(
            WritingSession.user_id == current_user.id,
            WritingSession.started_at >= start_date,
            WritingSession.started_at <= end_date,
        )
    ).all()
    
    # Build heatmap data (hour, day_of_week, session count)
    heatmap_data = {}
    for session in sessions:
        if session.started_at:
            hour = session.started_at.hour
            day_of_week = session.started_at.weekday()
            key = f"{day_of_week}:{hour}"
            
            if key not in heatmap_data:
                heatmap_data[key] = {
                    "day": day_of_week,
                    "hour": hour,
                    "sessions": 0,
                    "total_words": 0,
                }
            
            heatmap_data[key]["sessions"] += 1
            heatmap_data[key]["total_words"] += session.net_words or 0
    
    return {
        "period_days": days,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "heatmap": list(heatmap_data.values()),
        "total_sessions": len(sessions),
        "total_words": sum(s.net_words or 0 for s in sessions),
    }


@router.get("/performance")
def get_writing_performance(
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get comprehensive writing performance analytics."""
    # Calculate date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Query sessions
    sessions = db.query(WritingSession).filter(
        and_(
            WritingSession.user_id == current_user.id,
            WritingSession.started_at >= start_date,
            WritingSession.started_at <= end_date,
        )
    ).all()
    
    if not sessions:
        return {
            "period_days": days,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_sessions": 0,
            "total_words": 0,
            "total_hours": 0,
            "avg_words_per_session": 0,
            "avg_session_duration": 0,
            "busiest_day": None,
            "busiest_hour": None,
            "session_types": {},
            "daily_breakdown": [],
        }
    
    # Calculate metrics
    total_words = sum(s.net_words or 0 for s in sessions)
    total_hours = sum((s.ended_at - s.started_at).total_seconds() / 3600 for s in sessions if s.ended_at)
    
    # By day of week
    daily_counts = {}
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    for session in sessions:
        if session.started_at:
            dow = session.started_at.weekday()
            if dow not in daily_counts:
                daily_counts[dow] = {"sessions": 0, "words": 0}
            daily_counts[dow]["sessions"] += 1
            daily_counts[dow]["words"] += session.net_words or 0
    
    # By hour
    hourly_counts = {}
    for session in sessions:
        if session.started_at:
            hour = session.started_at.hour
            if hour not in hourly_counts:
                hourly_counts[hour] = {"sessions": 0, "words": 0}
            hourly_counts[hour]["sessions"] += 1
            hourly_counts[hour]["words"] += session.net_words or 0
    
    # Session types
    session_types = {}
    for session in sessions:
        stype = session.session_type or "unknown"
        if stype not in session_types:
            session_types[stype] = 0
        session_types[stype] += 1
    
    # Find busiest
    busiest_day = max(daily_counts, key=lambda x: daily_counts[x]["sessions"]) if daily_counts else None
    busiest_hour = max(hourly_counts, key=lambda x: hourly_counts[x]["sessions"]) if hourly_counts else None
    
    return {
        "period_days": days,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_sessions": len(sessions),
        "total_words": total_words,
        "total_hours": round(total_hours, 1),
        "avg_words_per_session": int(total_words / len(sessions)) if sessions else 0,
        "avg_session_duration": round(total_hours / len(sessions) * 60, 1) if sessions else 0,
        "busiest_day": {"day": day_names[busiest_day] if busiest_day is not None else None, "sessions": daily_counts.get(busiest_day, {}).get("sessions", 0)},
        "busiest_hour": {"hour": busiest_hour, "sessions": hourly_counts.get(busiest_hour, {}).get("sessions", 0)},
        "session_types": session_types,
        "daily_breakdown": [
            {"day": day_names[i], "sessions": daily_counts.get(i, {}).get("sessions", 0), "words": daily_counts.get(i, {}).get("words", 0)}
            for i in range(7)
        ],
    }
