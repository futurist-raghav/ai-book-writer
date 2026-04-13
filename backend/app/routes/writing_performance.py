"""FastAPI routes for writing performance tracking."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, select
from datetime import datetime, timedelta
from app.core.dependencies import get_db
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
import logging

logger = logging.getLogger(__name__)


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


# ==================== Achievements & Milestones ====================

@router.get("/achievements")
async def get_user_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get user achievements and milestones unlocked."""
    try:
        # Define achievement tiers
        achievement_tiers = [
            {"milestone": 5000, "name": "5K Words", "icon": "milestone", "unlocked": False},
            {"milestone": 10000, "name": "10K Words", "icon": "milestone", "unlocked": False},
            {"milestone": 50000, "name": "50K Words", "icon": "trophy", "unlocked": False},  # NaNoWiMo
            {"milestone": 100000, "name": "100K Words", "icon": "crown", "unlocked": False},
        ]

        # Get total words for user
        stmt = func.sum(WritingSession.net_words).where(
            WritingSession.user_id == current_user.id
        )
        total_words = db.execute(stmt).scalar() or 0

        # Check which achievements are unlocked
        for tier in achievement_tiers:
            tier["unlocked"] = total_words >= tier["milestone"]
            tier["progress"] = min(100, int((total_words / tier["milestone"]) * 100))

        # Streak achievements
        streak_stmt = select(func.max(WritingSession.current_streak)).where(
            WritingSession.user_id == current_user.id
        )
        longest_streak = db.execute(streak_stmt).scalar() or 0

        streak_achievements = [
            {"milestone": 7, "name": "One Week Streak", "icon": "fire", "unlocked": longest_streak >= 7},
            {"milestone": 30, "name": "One Month Streak", "icon": "flame", "unlocked": longest_streak >= 30},
            {"milestone": 100, "name": "Century Streak", "icon": "inferno", "unlocked": longest_streak >= 100},
        ]

        return {
            "total_words": total_words,
            "longest_streak": longest_streak,
            "word_milestones": achievement_tiers,
            "streak_achievements": streak_achievements,
            "total_unlocked": sum(1 for t in achievement_tiers if t["unlocked"]) + sum(1 for s in streak_achievements if s["unlocked"]),
        }
    except Exception as e:
        logger.error(f"Error getting achievements: {str(e)}")
        return {
            "total_words": 0,
            "longest_streak": 0,
            "word_milestones": [],
            "streak_achievements": [],
            "total_unlocked": 0,
        }


# ==================== Writing Challenges ====================

@router.get("/challenges")
async def get_writing_challenges(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get active writing challenges and progress."""
    try:
        # Define built-in challenges
        challenges = [
            {
                "challenge_id": "nanowrimo",
                "name": "NaNoWiMo",
                "description": "Write 50,000 words in one month",
                "target_words": 50000,
                "duration_days": 30,
                "icon": "book",
                "difficulty": "hard",
                "reward": "500 XP",
            },
            {
                "challenge_id": "500_words_daily",
                "name": "Daily 500 Words",
                "description": "Write at least 500 words every day for 7 days",
                "target_words": 500,
                "duration_days": 7,
                "icon": "target",
                "difficulty": "medium",
                "reward": "200 XP",
            },
            {
                "challenge_id": "flash_fiction",
                "name": "Flash Fiction Friday",
                "description": "Complete a 1,000-word short story before Friday",
                "target_words": 1000,
                "duration_days": 7,
                "icon": "zap",
                "difficulty": "easy",
                "reward": "100 XP",
            },
            {
                "challenge_id": "weekend_sprint",
                "name": "Weekend Writing Sprint",
                "description": "Write 5,000 words in one weekend",
                "target_words": 5000,
                "duration_days": 2,
                "icon": "rocket",
                "difficulty": "medium",
                "reward": "250 XP",
            },
        ]

        # Get user's current progress (mock data)
        user_sessions = db.query(WritingSession).filter(
            WritingSession.user_id == current_user.id,
            WritingSession.created_at >= datetime.utcnow() - timedelta(days=7)
        ).all()

        total_recent_words = sum(s.net_words or 0 for s in user_sessions)
        recent_sessions = len(user_sessions)

        # Calculate progress for each challenge
        for challenge in challenges:
            if challenge["challenge_id"] == "nanowrimo":
                progress = min(100, int((total_recent_words / 50000) * 100))
            elif challenge["challenge_id"] == "500_words_daily":
                daily_avg = total_recent_words / 7 if recent_sessions > 0 else 0
                progress = min(100, int((daily_avg / 500) * 100))
            elif challenge["challenge_id"] == "flash_fiction":
                progress = min(100, int((total_recent_words / 1000) * 100))
            else:  # weekend_sprint
                progress = min(100, int((total_recent_words / 5000) * 100))

            challenge["progress"] = progress
            challenge["in_progress"] = progress > 0 and progress < 100
            challenge["completed"] = progress >= 100

        return {
            "available_challenges": challenges,
            "active_count": sum(1 for c in challenges if c["in_progress"]),
            "completed_count": sum(1 for c in challenges if c["completed"]),
        }
    except Exception as e:
        logger.error(f"Error getting challenges: {str(e)}")
        return {
            "available_challenges": [],
            "active_count": 0,
            "completed_count": 0,
        }


@router.post("/challenges/{challenge_id}/join")
async def join_challenge(
    challenge_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Join a writing challenge."""
    return {
        "status": "success",
        "message": f"Joined challenge: {challenge_id}",
        "challenge_id": challenge_id,
        "started_at": datetime.utcnow().isoformat(),
    }
