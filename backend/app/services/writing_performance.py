"""Services for writing performance tracking."""

from datetime import datetime, timedelta
from typing import List, Optional
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.writing_performance import (
    WritingSession,
    WriterMilestone,
    WritingStreak,
    WritingChallenge,
)
from app.schemas.writing_performance import (
    WritingSessionCreate,
    WritingSessionUpdate,
    WritingStreakResponse,
    WritingStatsResponse,
)


class WritingPerformanceService:
    """Service for writing performance operations."""
    
    @staticmethod
    def create_session(db: Session, session_data: WritingSessionCreate) -> WritingSession:
        """Create new writing session."""
        session = WritingSession(
            id=str(uuid4()),
            user_id=session_data.user_id,
            book_id=session_data.book_id,
            started_at=datetime.utcnow(),
            session_type=session_data.session_type,
            notes=session_data.notes,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session
    
    @staticmethod
    def end_session(
        db: Session,
        session_id: str,
        update_data: WritingSessionUpdate,
    ) -> WritingSession:
        """End writing session with metrics."""
        session = db.query(WritingSession).filter_by(id=session_id).first()
        if not session:
            return None
        
        # Update metrics
        session.ended_at = update_data.ended_at or datetime.utcnow()
        session.words_written = update_data.words_written or 0
        session.words_deleted = update_data.words_deleted or 0
        session.net_words = update_data.net_words or (session.words_written - session.words_deleted)
        session.characters_changed = update_data.characters_changed or 0
        
        db.commit()
        db.refresh(session)
        
        # Update streak
        WritingPerformanceService._update_streak(db, session.user_id)
        
        # Check milestones
        WritingPerformanceService._check_milestones(db, session.user_id, session.book_id)
        
        return session
    
    @staticmethod
    def get_user_stats(db: Session, user_id: str) -> WritingStatsResponse:
        """Get aggregated writing stats for user."""
        # Session stats
        sessions = db.query(WritingSession).filter_by(user_id=user_id).all()
        
        total_sessions = len(sessions)
        total_words = sum(s.net_words for s in sessions if s.ended_at)
        avg_session = (
            int(total_words / total_sessions) if total_sessions > 0 else 0
        )
        
        # Streak
        streak = db.query(WritingStreak).filter_by(user_id=user_id).first()
        current_streak = streak.current_streak if streak else 0
        longest_streak = streak.longest_streak if streak else 0
        
        # Challenges
        active = db.query(WritingChallenge).filter(
            WritingChallenge.user_id == user_id,
            WritingChallenge.is_active == 1,
        ).count()
        
        # Milestones
        milestones = db.query(WriterMilestone).filter(
            WriterMilestone.user_id == user_id,
            WriterMilestone.is_unlocked == 1,
        ).count()
        
        last_session = db.query(WritingSession).filter_by(user_id=user_id).order_by(
            WritingSession.ended_at.desc()
        ).first()
        
        return WritingStatsResponse(
            total_sessions=total_sessions,
            total_words=total_words,
            average_session_length=avg_session,
            current_streak=current_streak,
            longest_streak=longest_streak,
            active_challenges=active,
            unlocked_milestones=milestones,
            last_session_at=last_session.ended_at if last_session else None,
        )
    
    @staticmethod
    def _update_streak(db: Session, user_id: str) -> None:
        """Update writing streak."""
        streak = db.query(WritingStreak).filter_by(user_id=user_id).first()
        
        if not streak:
            streak = WritingStreak(
                id=str(uuid4()),
                user_id=user_id,
            )
            db.add(streak)
        
        # Check if today has writing
        today = datetime.utcnow().date()
        today_session = db.query(WritingSession).filter(
            WritingSession.user_id == user_id,
            func.date(WritingSession.ended_at) == today,
        ).first()
        
        yesterday = today - timedelta(days=1)
        yesterday_session = db.query(WritingSession).filter(
            WritingSession.user_id == user_id,
            func.date(WritingSession.ended_at) == yesterday,
        ).first()
        
        if today_session:
            # Has session today
            if yesterday_session or streak.last_written_at is None:
                # Continue streak
                streak.current_streak += 1
                streak.total_days_written += 1
            else:
                # Start new streak
                streak.current_streak = 1
                streak.total_days_written += 1
            
            # Update longest
            if streak.current_streak > streak.longest_streak:
                streak.longest_streak = streak.current_streak
        
        streak.last_written_at = datetime.utcnow()
        streak.updated_at = datetime.utcnow()
        db.commit()
    
    @staticmethod
    def _check_milestones(db: Session, user_id: str, book_id: Optional[str]) -> None:
        """Check and unlock milestones."""
        sessions = db.query(WritingSession).filter_by(user_id=user_id).all()
        total_words = sum(s.net_words for s in sessions if s.ended_at)
        
        milestone_configs = [
            ("1k_words", "1,000 Words Written", 1000),
            ("5k_words", "5,000 Words Written", 5000),
            ("10k_words", "10,000 Words Written", 10000),
            ("50k_words", "50,000 Words Written", 50000),
        ]
        
        for mtype, title, target in milestone_configs:
            milestone = db.query(WriterMilestone).filter_by(
                user_id=user_id,
                milestone_type=mtype,
            ).first()
            
            if not milestone:
                milestone = WriterMilestone(
                    id=str(uuid4()),
                    user_id=user_id,
                    milestone_type=mtype,
                    title=title,
                    target_value=target,
                )
                db.add(milestone)
            
            milestone.current_value = total_words
            milestone.progress_percent = min(100, int((total_words / target) * 100))
            
            if total_words >= target and not milestone.is_unlocked:
                milestone.is_unlocked = 1
                milestone.unlocked_at = datetime.utcnow()
        
        db.commit()
    
    @staticmethod
    def create_challenge(
        db: Session,
        challenge_data,
    ) -> WritingChallenge:
        """Create writing challenge."""
        challenge = WritingChallenge(
            id=str(uuid4()),
            user_id=challenge_data.user_id,
            book_id=challenge_data.book_id,
            challenge_name=challenge_data.challenge_name,
            challenge_type=challenge_data.challenge_type,
            target_words=challenge_data.target_words,
            started_at=challenge_data.started_at,
            ends_at=challenge_data.ends_at,
        )
        db.add(challenge)
        db.commit()
        db.refresh(challenge)
        return challenge
    
    @staticmethod
    def update_challenge_progress(
        db: Session,
        challenge_id: str,
        new_words: int,
    ) -> WritingChallenge:
        """Update challenge progress."""
        challenge = db.query(WritingChallenge).filter_by(id=challenge_id).first()
        if not challenge:
            return None
        
        challenge.current_words = new_words
        challenge.progress_percent = min(100, int((new_words / challenge.target_words) * 100))
        
        if new_words >= challenge.target_words and not challenge.is_completed:
            challenge.is_completed = 1
            challenge.completed_at = datetime.utcnow()
        
        db.commit()
        db.refresh(challenge)
        return challenge
