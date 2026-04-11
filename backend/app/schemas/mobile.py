"""Mobile app validation schemas."""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class MobileSessionCreate(BaseModel):
    """Create mobile session."""
    device_id: str
    device_type: str  # ios, android
    device_model: Optional[str] = None
    app_version: str


class MobileSessionResponse(BaseModel):
    """Mobile session response."""
    id: str
    user_id: str
    device_id: str
    device_type: str
    app_version: str
    is_active: bool
    last_activity_at: datetime
    push_token: Optional[str]
    
    class Config:
        orm_mode = True


class OfflineDraftCreate(BaseModel):
    """Create offline draft."""
    chapter_id: str
    content: str
    device_id: str


class OfflineDraftSync(BaseModel):
    """Sync offline draft."""
    chapter_id: str
    content: str
    local_version: int
    device_id: str


class OfflineDraftResponse(BaseModel):
    """Offline draft response."""
    id: str
    chapter_id: str
    book_id: str
    content: Optional[str]
    sync_status: str
    local_version: int
    last_synced_version: int
    updated_at: datetime
    synced_at: Optional[datetime]
    
    class Config:
        orm_mode = True


class MobileNotificationCreate(BaseModel):
    """Create notification."""
    title: str
    body: str
    notification_type: str
    deep_link: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class MobileNotificationResponse(BaseModel):
    """Notification response."""
    id: str
    title: str
    body: str
    notification_type: str
    is_sent: bool
    is_read: bool
    created_at: datetime
    deep_link: Optional[str]
    
    class Config:
        orm_mode = True


class VoiceNoteCreate(BaseModel):
    """Create voice note."""
    book_id: str
    chapter_id: Optional[str] = None
    audio_url: str
    audio_duration_seconds: int
    language: str = "en"


class VoiceNoteResponse(BaseModel):
    """Voice note response."""
    id: str
    book_id: str
    chapter_id: Optional[str]
    audio_url: str
    audio_duration_seconds: int
    transcription: Optional[str]
    transcription_status: str
    transcription_confidence: float
    is_converted_to_text: bool
    created_at: datetime
    
    class Config:
        orm_mode = True


class ReadingModeUpdate(BaseModel):
    """Update reading preferences."""
    font_size: Optional[int] = None
    font_family: Optional[str] = None
    line_height: Optional[float] = None
    theme: Optional[str] = None
    current_chapter_id: Optional[str] = None
    current_position_percent: Optional[float] = None


class ReadingModeResponse(BaseModel):
    """Reading mode preferences."""
    id: str
    book_id: str
    font_size: int
    font_family: str
    line_height: float
    theme: str
    current_chapter_id: Optional[str]
    current_position_percent: float
    last_read_at: Optional[datetime]
    
    class Config:
        orm_mode = True


class AppAnalyticsEvent(BaseModel):
    """App analytics event."""
    device_id: str
    session_duration_seconds: int
    pages_viewed: int
    characters_added: int
    characters_deleted: int
    time_writing: int
    features_used: List[str]
    crash_count: int = 0
    error_count: int = 0


class MobileAppInfo(BaseModel):
    """Mobile app information."""
    app_version: str
    min_version: str  # Minimum supported version
    latest_version: str
    download_url_ios: str
    download_url_android: str
    features: List[str]
    changelog: str
    release_date: datetime
    is_required_update: bool
