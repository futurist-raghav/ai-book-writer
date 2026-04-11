"""Mobile app API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth import get_current_user
from app.models.user import User
from app.services.mobile import (
    MobileSessionService,
    OfflineDraftService,
    MobileNotificationService,
    VoiceNoteService,
    ReadingModeService,
    AppAnalyticsService,
)
from app.schemas.mobile import (
    MobileSessionCreate,
    OfflineDraftCreate,
    OfflineDraftSync,
    MobileNotificationCreate,
    VoiceNoteCreate,
    ReadingModeUpdate,
    AppAnalyticsEvent,
)


router = APIRouter(prefix="/mobile", tags=["mobile"])


# ===== SESSIONS =====

@router.post("/sessions")
def create_session(data: MobileSessionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create/update mobile session."""
    session = MobileSessionService.create_session(db, current_user.id, data)
    return {
        "id": session.id,
        "device_id": session.device_id,
        "is_active": bool(session.is_active),
        "created_at": session.created_at,
    }


@router.post("/sessions/{device_id}/activity")
def update_activity(device_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update session activity timestamp."""
    session = MobileSessionService.update_activity(db, current_user.id, device_id)
    return {"last_activity_at": session.last_activity_at if session else None}


@router.post("/sessions/{device_id}/push-token")
def set_push_token(device_id: str, push_token: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Store push notification token."""
    session = MobileSessionService.update_push_token(db, current_user.id, device_id, push_token)
    return {"status": "token_updated"}


# ===== OFFLINE DRAFTS =====

@router.post("/drafts")
def create_draft(data: OfflineDraftCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create offline draft."""
    draft = OfflineDraftService.create_draft(db, current_user.id, data)
    return {
        "id": draft.id,
        "chapter_id": draft.chapter_id,
        "sync_status": draft.sync_status,
        "local_version": draft.local_version,
    }


@router.post("/drafts/sync")
def sync_draft(data: OfflineDraftSync, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Sync offline draft to server."""
    draft = OfflineDraftService.sync_draft(db, current_user.id, data)
    if not draft:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    return {
        "id": draft.id,
        "sync_status": draft.sync_status,
        "synced_at": draft.synced_at,
    }


@router.get("/drafts/pending")
def get_pending_drafts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get drafts pending sync."""
    drafts = OfflineDraftService.get_pending_drafts(db, current_user.id)
    return [
        {
            "id": d.id,
            "chapter_id": d.chapter_id,
            "book_id": d.book_id,
            "sync_status": d.sync_status,
            "local_version": d.local_version,
            "updated_at": d.updated_at,
        }
        for d in drafts
    ]


# ===== NOTIFICATIONS =====

@router.get("/notifications")
def get_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get user's notifications."""
    from app.models.mobile import MobileNotification
    notifications = db.query(MobileNotification).filter(
        MobileNotification.user_id == current_user.id
    ).order_by(MobileNotification.created_at.desc()).limit(50).all()
    
    return [
        {
            "id": n.id,
            "title": n.title,
            "body": n.body,
            "is_read": bool(n.is_read),
            "deep_link": n.deep_link,
            "created_at": n.created_at,
        }
        for n in notifications
    ]


@router.get("/notifications/unread-count")
def get_unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get unread notification count."""
    count = MobileNotificationService.get_unread_count(db, current_user.id)
    return {"unread_count": count}


@router.post("/notifications/{notification_id}/read")
def mark_as_read(notification_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Mark notification as read."""
    notification = MobileNotificationService.mark_read(db, notification_id)
    return {"read_at": notification.read_at if notification else None}


# ===== VOICE NOTES =====

@router.post("/voice-notes")
def create_voice_note(data: VoiceNoteCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create voice note."""
    note = VoiceNoteService.create_voice_note(
        db, current_user.id,
        book_id=data.book_id,
        chapter_id=data.chapter_id,
        audio_url=data.audio_url,
        audio_duration_seconds=data.audio_duration_seconds,
        language=data.language,
        transcription_status="processing",
    )
    return {
        "id": note.id,
        "transcription_status": note.transcription_status,
        "language": note.language,
    }


@router.get("/voice-notes/{note_id}")
def get_voice_note(note_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get voice note and transcription."""
    from app.models.mobile import VoiceNote
    note = db.query(VoiceNote).filter(
        VoiceNote.id == note_id,
        VoiceNote.user_id == current_user.id,
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Voice note not found")
    
    return {
        "id": note.id,
        "transcription": note.transcription,
        "transcription_status": note.transcription_status,
        "transcription_confidence": note.transcription_confidence,
        "is_converted_to_text": bool(note.is_converted_to_text),
    }


@router.post("/voice-notes/{note_id}/convert")
def convert_to_text(note_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Convert voice note to text and insert into chapter."""
    from app.models.mobile import VoiceNote
    
    note = db.query(VoiceNote).filter(
        VoiceNote.id == note_id,
        VoiceNote.user_id == current_user.id,
    ).first()
    
    if not note or not note.transcription:
        raise HTTPException(status_code=404, detail="Voice note not found or not transcribed")
    
    note = VoiceNoteService.convert_to_text(db, note_id)
    
    return {
        "status": "converted",
        "chapter_id": note.chapter_id,
        "converted_at": note.converted_at,
    }


# ===== READING MODE =====

@router.get("/books/{book_id}/reading-mode")
def get_reading_mode(book_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get reading preferences for book."""
    mode = ReadingModeService.get_or_create(db, current_user.id, book_id)
    return {
        "id": mode.id,
        "font_size": mode.font_size,
        "font_family": mode.font_family,
        "line_height": mode.line_height,
        "theme": mode.theme,
        "current_chapter_id": mode.current_chapter_id,
        "current_position_percent": mode.current_position_percent,
        "last_read_at": mode.last_read_at,
    }


@router.patch("/books/{book_id}/reading-mode")
def update_reading_mode(book_id: str, data: ReadingModeUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update reading mode preferences."""
    mode = ReadingModeService.update_preferences(db, current_user.id, book_id, data)
    return {"updated_at": mode.updated_at}


@router.post("/books/{book_id}/reading-position")
def record_position(book_id: str, chapter_id: str, position: float, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Record reading position."""
    mode = ReadingModeService.record_reading_position(db, current_user.id, book_id, chapter_id, position)
    return {"recorded_at": mode.last_read_at}


# ===== ANALYTICS =====

@router.post("/analytics")
def log_analytics(event: AppAnalyticsEvent, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Log app analytics event."""
    analytics = AppAnalyticsService.log_event(db, current_user.id, event)
    return {"recorded": True}


@router.get("/analytics/stats")
def get_analytics_stats(days: int = 7, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get app usage statistics."""
    stats = AppAnalyticsService.get_user_stats(db, current_user.id, days)
    return stats


# ===== APP INFO =====

@router.get("/app-info")
def get_app_info():
    """Get current app version and download info."""
    return {
        "app_version": "1.0.0",
        "min_version": "1.0.0",
        "latest_version": "1.0.0",
        "download_url_ios": "https://apps.apple.com/app/aibook",
        "download_url_android": "https://play.google.com/store/apps/details?id=com.aibook",
        "features": [
            "offline-writing",
            "voice-notes",
            "reading-mode",
            "push-notifications",
            "sync",
        ],
        "changelog": "Initial release with offline writing and sync",
        "is_required_update": False,
    }
