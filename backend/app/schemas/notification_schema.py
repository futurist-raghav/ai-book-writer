"""
Notification schemas for API requests/responses
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel


class DeviceTokenRegisterRequest(BaseModel):
    """Request to register device token"""

    device_token: str
    platform: str  # 'ios' or 'android'
    app_version: Optional[str] = None


class DeviceTokenResponse(BaseModel):
    """Response with device token info"""

    id: str
    user_id: str
    device_token: str
    platform: str
    app_version: Optional[str]
    is_active: bool
    last_registered_at: datetime

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    """Single notification response"""

    id: str
    user_id: str
    title: str
    body: str
    type: str  # 'chapter_update' | 'collaboration' | 'assignment' | 'milestone' | 'system'
    data: Dict[str, Any]
    action_url: Optional[str]
    related_book_id: Optional[str]
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    """List of notifications response"""

    notifications: List[NotificationResponse]
    unread_count: int
    total: int


class NotificationPreferenceUpdate(BaseModel):
    """Update notification preferences"""

    chapter_updates: Optional[bool] = None
    collaboration: Optional[bool] = None
    assignments: Optional[bool] = None
    milestones: Optional[bool] = None
    marketing: Optional[bool] = None
    push_notifications: Optional[bool] = None
    email_notifications: Optional[bool] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None  # HH:MM format
    quiet_hours_end: Optional[str] = None  # HH:MM format


class NotificationPreferenceResponse(BaseModel):
    """Notification preferences response"""

    id: Optional[str]
    user_id: str
    chapter_updates: bool
    collaboration: bool
    assignments: bool
    milestones: bool
    marketing: bool
    push_notifications: bool = True
    email_notifications: bool = False
    quiet_hours_enabled: bool = False
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# Notification event schemas for internal use

class NotificationEventData(BaseModel):
    """Base notification event data"""

    title: str
    body: str
    type: str
    data: Dict[str, Any] = {}
    action_url: Optional[str] = None
    related_book_id: Optional[str] = None


class ChapterUpdateEvent(NotificationEventData):
    """Chapter update notification"""

    type: str = "chapter_update"
    chapter_id: str
    chapter_title: str
    book_id: str


class CollaborationEvent(NotificationEventData):
    """Collaboration notification"""

    type: str = "collaboration"
    collaborator_name: str
    action: str  # 'invited', 'comment', 'edit'
    book_id: str


class AssignmentEvent(NotificationEventData):
    """Assignment notification"""

    type: str = "assignment"
    assignment_id: str
    assignment_title: str
    classroom_id: str


class MilestoneEvent(NotificationEventData):
    """Milestone achievement notification"""

    type: str = "milestone"
    milestone_type: str  # 'words', 'streak', 'achievement'
    milestone_value: int
    book_id: Optional[str] = None
