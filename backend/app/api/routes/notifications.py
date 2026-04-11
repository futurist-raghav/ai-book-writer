"""
API routes for managing notifications
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.services.notification_service import NotificationService
from app.schemas.notification_schema import (
    DeviceTokenRegisterRequest,
    DeviceTokenResponse,
    NotificationResponse,
    NotificationListResponse,
    NotificationPreferenceUpdate,
    NotificationPreferenceResponse,
)

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.post(
    "/register-device",
    response_model=DeviceTokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_device(
    request: DeviceTokenRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Register device for push notifications"""
    token = NotificationService.register_device(
        db,
        user_id=current_user.id,
        device_token=request.device_token,
        platform=request.platform,
        app_version=request.app_version,
    )
    return token


@router.post("/unregister-device")
async def unregister_device(
    request: DeviceTokenRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unregister device from push notifications"""
    success = NotificationService.unregister_device(
        db,
        user_id=current_user.id,
        device_token=request.device_token,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device token not found",
        )
    return {"success": True}


@router.get("/", response_model=NotificationListResponse)
async def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    unread_only: bool = Query(False),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
):
    """Get notifications for current user"""
    notifications = NotificationService.get_user_notifications(
        db,
        user_id=current_user.id,
        unread_only=unread_only,
        limit=limit,
        offset=offset,
    )
    unread_count = NotificationService.get_unread_count(db, current_user.id)

    return NotificationListResponse(
        notifications=notifications,
        unread_count=unread_count,
        total=unread_count if unread_only else len(notifications),
    )


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get specific notification"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return notification


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark notification as read"""
    notification = NotificationService.mark_notification_read(
        db,
        notification_id=notification_id,
        user_id=current_user.id,
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return notification


@router.post("/mark-all-read")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all notifications as read for user"""
    count = NotificationService.mark_all_notifications_read(
        db,
        user_id=current_user.id,
    )
    return {"marked_read": count}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete notification"""
    success = NotificationService.delete_notification(
        db,
        notification_id=notification_id,
        user_id=current_user.id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return {"success": True}


@router.get("/preferences/me", response_model=NotificationPreferenceResponse)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get notification preferences for current user"""
    prefs = NotificationService.get_notification_preferences(db, current_user.id)
    if not prefs:
        # Return defaults
        return NotificationPreferenceResponse(
            user_id=current_user.id,
            chapter_updates=True,
            collaboration=True,
            assignments=True,
            milestones=True,
            marketing=False,
        )
    return prefs


@router.patch("/preferences/me", response_model=NotificationPreferenceResponse)
async def update_preferences(
    request: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update notification preferences"""
    prefs = NotificationService.update_notification_preferences(
        db,
        user_id=current_user.id,
        **request.dict(exclude_unset=True),
    )
    return prefs


@router.get("/unread/count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get unread notification count for user"""
    count = NotificationService.get_unread_count(db, current_user.id)
    return {"unread_count": count}


@router.post("/send-test")
async def send_test_notification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send a test notification to verify device registration.
    
    Useful for debugging and testing notification delivery.
    """
    from app.workers.push_notification_sender import PushNotificationSender
    
    result = await PushNotificationSender.send_test_notification(db, current_user.id)
    
    return {
        "message": "Test notification sent",
        "result": result,
    }
