"""Mobile app services."""

from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from uuid import uuid4
from app.models.mobile import (
    MobileSession,
    OfflineDraft,
    MobileNotification,
    VoiceNote,
    ReadingMode,
    AppAnalytics,
)
from app.schemas.mobile import (
    MobileSessionCreate,
    OfflineDraftCreate,
    OfflineDraftSync,
    MobileNotificationCreate,
    ReadingModeUpdate,
    AppAnalyticsEvent,
)


class MobileSessionService:
    """Mobile session management."""
    
    @staticmethod
    def create_session(db: Session, user_id: str, data: MobileSessionCreate) -> MobileSession:
        """Create or update mobile session."""
        # Check if session exists for this device
        session = db.query(MobileSession).filter(
            MobileSession.user_id == user_id,
            MobileSession.device_id == data.device_id,
        ).first()
        
        if session:
            session.app_version = data.app_version
            session.last_activity_at = datetime.utcnow()
            session.is_active = 1
        else:
            session = MobileSession(
                id=str(uuid4()),
                user_id=user_id,
                device_id=data.device_id,
                device_type=data.device_type,
                device_model=data.device_model,
                app_version=data.app_version,
            )
            db.add(session)
        
        db.commit()
        return session
    
    @staticmethod
    def update_activity(db: Session, user_id: str, device_id: str) -> MobileSession:
        """Update last activity timestamp."""
        session = db.query(MobileSession).filter(
            MobileSession.user_id == user_id,
            MobileSession.device_id == device_id,
        ).first()
        
        if session:
            session.last_activity_at = datetime.utcnow()
            db.commit()
        
        return session
    
    @staticmethod
    def update_push_token(db: Session, user_id: str, device_id: str, push_token: str) -> MobileSession:
        """Store push notification token."""
        session = db.query(MobileSession).filter(
            MobileSession.user_id == user_id,
            MobileSession.device_id == device_id,
        ).first()
        
        if session:
            session.push_token = push_token
            db.commit()
        
        return session


class OfflineDraftService:
    """Offline draft management."""
    
    @staticmethod
    def create_draft(db: Session, user_id: str, data: OfflineDraftCreate) -> OfflineDraft:
        """Create offline draft."""
        draft = OfflineDraft(
            id=str(uuid4()),
            user_id=user_id,
            chapter_id=data.chapter_id,
            book_id="",  # Will fetch from chapter
            content=data.content,
            device_id=data.device_id,
            sync_status="pending",
        )
        db.add(draft)
        db.commit()
        return draft
    
    @staticmethod
    def sync_draft(db: Session, user_id: str, data: OfflineDraftSync) -> OfflineDraft:
        """Sync offline draft to server."""
        from app.models.chapter import Chapter
        
        # Get chapter to find book_id
        chapter = db.query(Chapter).filter(Chapter.id == data.chapter_id).first()
        if not chapter:
            return None
        
        # Check for existing draft
        draft = db.query(OfflineDraft).filter(
            OfflineDraft.user_id == user_id,
            OfflineDraft.chapter_id == data.chapter_id,
            OfflineDraft.device_id == data.device_id,
        ).first()
        
        if draft:
            draft.content = data.content
            draft.local_version = data.local_version
            draft.sync_status = "synced"
            draft.synced_at = datetime.utcnow()
        else:
            draft = OfflineDraft(
                id=str(uuid4()),
                user_id=user_id,
                chapter_id=data.chapter_id,
                book_id=chapter.book_id,
                content=data.content,
                device_id=data.device_id,
                local_version=data.local_version,
                sync_status="synced",
                synced_at=datetime.utcnow(),
            )
            db.add(draft)
        
        db.commit()
        return draft
    
    @staticmethod
    def get_pending_drafts(db: Session, user_id: str) -> list:
        """Get drafts pending sync."""
        return db.query(OfflineDraft).filter(
            OfflineDraft.user_id == user_id,
            OfflineDraft.sync_status == "pending",
        ).all()


class MobileNotificationService:
    """Mobile push notification management."""
    
    @staticmethod
    def create_notification(db: Session, user_id: str, data: MobileNotificationCreate) -> MobileNotification:
        """Create notification for mobile user."""
        notification = MobileNotification(
            id=str(uuid4()),
            user_id=user_id,
            title=data.title,
            body=data.body,
            notification_type=data.notification_type,
            deep_link=data.deep_link,
            data=data.data or {},
        )
        db.add(notification)
        db.commit()
        return notification
    
    @staticmethod
    def mark_sent(db: Session, notification_id: str) -> MobileNotification:
        """Mark notification as sent."""
        notification = db.query(MobileNotification).filter(
            MobileNotification.id == notification_id
        ).first()
        
        if notification:
            notification.is_sent = 1
            notification.sent_at = datetime.utcnow()
            db.commit()
        
        return notification
    
    @staticmethod
    def mark_read(db: Session, notification_id: str) -> MobileNotification:
        """Mark notification as read."""
        notification = db.query(MobileNotification).filter(
            MobileNotification.id == notification_id
        ).first()
        
        if notification:
            notification.is_read = 1
            notification.read_at = datetime.utcnow()
            db.commit()
        
        return notification
    
    @staticmethod
    def get_unread_count(db: Session, user_id: str) -> int:
        """Get count of unread notifications."""
        return db.query(MobileNotification).filter(
            MobileNotification.user_id == user_id,
            MobileNotification.is_read == 0,
        ).count()


class VoiceNoteService:
    """Voice note and transcription management."""
    
    @staticmethod
    def create_voice_note(db: Session, user_id: str, **kwargs) -> VoiceNote:
        """Create voice note."""
        note = VoiceNote(
            id=str(uuid4()),
            user_id=user_id,
            **kwargs,
        )
        db.add(note)
        db.commit()
        return note
    
    @staticmethod
    def update_transcription(db: Session, note_id: str, transcription: str, confidence: float = 0.9) -> VoiceNote:
        """Update voice note with transcription."""
        note = db.query(VoiceNote).filter(VoiceNote.id == note_id).first()
        
        if note:
            note.transcription = transcription
            note.transcription_status = "completed"
            note.transcription_confidence = confidence
            db.commit()
        
        return note
    
    @staticmethod
    def convert_to_text(db: Session, note_id: str) -> VoiceNote:
        """Mark voice note as converted to text."""
        note = db.query(VoiceNote).filter(VoiceNote.id == note_id).first()
        
        if note and note.transcription:
            note.is_converted_to_text = 1
            note.converted_at = datetime.utcnow()
            db.commit()
        
        return note


class ReadingModeService:
    """Reading mode preferences."""
    
    @staticmethod
    def get_or_create(db: Session, user_id: str, book_id: str) -> ReadingMode:
        """Get or create reading mode preferences."""
        mode = db.query(ReadingMode).filter(
            ReadingMode.user_id == user_id,
            ReadingMode.book_id == book_id,
        ).first()
        
        if not mode:
            mode = ReadingMode(
                id=str(uuid4()),
                user_id=user_id,
                book_id=book_id,
            )
            db.add(mode)
            db.commit()
        
        return mode
    
    @staticmethod
    def update_preferences(db: Session, user_id: str, book_id: str, data: ReadingModeUpdate) -> ReadingMode:
        """Update reading preferences."""
        mode = ReadingModeService.get_or_create(db, user_id, book_id)
        
        for key, val in data.dict(exclude_unset=True).items():
            if hasattr(mode, key):
                setattr(mode, key, val)
        
        mode.updated_at = datetime.utcnow()
        db.commit()
        
        return mode
    
    @staticmethod
    def record_reading_position(db: Session, user_id: str, book_id: str, chapter_id: str, position: float) -> ReadingMode:
        """Record reading position."""
        mode = ReadingModeService.get_or_create(db, user_id, book_id)
        
        mode.current_chapter_id = chapter_id
        mode.current_position_percent = position
        mode.last_read_at = datetime.utcnow()
        db.commit()
        
        return mode


class AppAnalyticsService:
    """App analytics tracking."""
    
    @staticmethod
    def log_event(db: Session, user_id: str, event: AppAnalyticsEvent) -> AppAnalytics:
        """Log app analytics event."""
        analytics = AppAnalytics(
            id=str(uuid4()),
            user_id=user_id,
            device_id=event.device_id,
            session_duration_seconds=event.session_duration_seconds,
            pages_viewed=event.pages_viewed,
            actions_taken=0,
            characters_added=event.characters_added,
            characters_deleted=event.characters_deleted,
            time_writing=event.time_writing,
            features_used=event.features_used,
            crash_count=event.crash_count,
            error_count=event.error_count,
        )
        db.add(analytics)
        db.commit()
        return analytics
    
    @staticmethod
    def get_user_stats(db: Session, user_id: str, days: int = 7) -> dict:
        """Get user's app analytics for period."""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        events = db.query(AppAnalytics).filter(
            AppAnalytics.user_id == user_id,
            AppAnalytics.recorded_at >= start_date,
        ).all()
        
        if not events:
            return {
                "total_sessions": 0,
                "total_writing_time": 0,
                "total_characters_added": 0,
                "avg_session_duration": 0,
                "days_active": 0,
            }
        
        return {
            "total_sessions": len(events),
            "total_writing_time": sum(e.time_writing for e in events),
            "total_characters_added": sum(e.characters_added for e in events),
            "total_characters_deleted": sum(e.characters_deleted for e in events),
            "avg_session_duration": sum(e.session_duration_seconds for e in events) // len(events) if events else 0,
            "days_active": len(set(e.recorded_at.date() for e in events)),
        }
