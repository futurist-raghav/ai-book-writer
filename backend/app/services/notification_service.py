"""
Notification service for managing push notifications
"""
from typing import List, Optional, Dict
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.notification import (
    DeviceToken,
    Notification,
    NotificationPreference,
    NotificationType,
)


class NotificationService:
    """Service for managing notifications and device tokens"""

    @staticmethod
    def register_device(
        db: Session,
        user_id: str,
        device_token: str,
        platform: str,
        app_version: str = None,
    ) -> DeviceToken:
        """Register device token for push notifications"""
        # Check if token already exists
        existing = db.query(DeviceToken).filter(
            DeviceToken.device_token == device_token,
            DeviceToken.user_id == user_id,
        ).first()

        if existing:
            existing.last_registered_at = datetime.utcnow()
            existing.is_active = True
            db.commit()
            return existing

        # Create new device token
        token = DeviceToken(
            user_id=user_id,
            device_token=device_token,
            platform=platform,
            app_version=app_version,
            is_active=True,
        )
        db.add(token)
        db.commit()
        db.refresh(token)
        return token

    @staticmethod
    def unregister_device(
        db: Session,
        user_id: str,
        device_token: str,
    ) -> bool:
        """Unregister device token"""
        token = db.query(DeviceToken).filter(
            DeviceToken.device_token == device_token,
            DeviceToken.user_id == user_id,
        ).first()

        if token:
            token.is_active = False
            db.commit()
            return True
        return False

    @staticmethod
    def create_notification(
        db: Session,
        user_id: str,
        title: str,
        body: str,
        notification_type: NotificationType,
        data: Dict = None,
        action_url: str = None,
        related_book_id: str = None,
    ) -> Notification:
        """Create a notification for user"""
        notification = Notification(
            user_id=user_id,
            title=title,
            body=body,
            type=notification_type,
            data=data or {},
            action_url=action_url,
            related_book_id=related_book_id,
            is_read=False,
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)
        return notification

    @staticmethod
    def get_user_notifications(
        db: Session,
        user_id: str,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Notification]:
        """Get notifications for user"""
        query = db.query(Notification).filter(
            Notification.user_id == user_id,
        )

        if unread_only:
            query = query.filter(Notification.is_read == False)

        return query.order_by(
            Notification.created_at.desc()
        ).limit(limit).offset(offset).all()

    @staticmethod
    def mark_notification_read(
        db: Session,
        notification_id: str,
        user_id: str,
    ) -> Optional[Notification]:
        """Mark notification as read"""
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        ).first()

        if notification:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            db.commit()
            db.refresh(notification)
        return notification

    @staticmethod
    def mark_all_notifications_read(
        db: Session,
        user_id: str,
    ) -> int:
        """Mark all notifications as read for user"""
        count = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False,
        ).update({
            Notification.is_read: True,
            Notification.read_at: datetime.utcnow(),
        })
        db.commit()
        return count

    @staticmethod
    def delete_notification(
        db: Session,
        notification_id: str,
        user_id: str,
    ) -> bool:
        """Delete notification"""
        result = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        ).delete()
        db.commit()
        return result > 0

    @staticmethod
    def get_unread_count(
        db: Session,
        user_id: str,
    ) -> int:
        """Get count of unread notifications"""
        return db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False,
        ).count()

    @staticmethod
    def get_notification_preferences(
        db: Session,
        user_id: str,
    ) -> Optional[NotificationPreference]:
        """Get notification preferences for user"""
        return db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id,
        ).first()

    @staticmethod
    def update_notification_preferences(
        db: Session,
        user_id: str,
        **preferences,
    ) -> NotificationPreference:
        """Update notification preferences"""
        pref = db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id,
        ).first()

        if not pref:
            pref = NotificationPreference(user_id=user_id)
            db.add(pref)

        for key, value in preferences.items():
            if hasattr(pref, key):
                setattr(pref, key, value)

        db.commit()
        db.refresh(pref)
        return pref

    @staticmethod
    def get_active_device_tokens(
        db: Session,
        user_id: str,
    ) -> List[DeviceToken]:
        """Get all active device tokens for user"""
        return db.query(DeviceToken).filter(
            DeviceToken.user_id == user_id,
            DeviceToken.is_active == True,
        ).all()

    @staticmethod
    def cleanup_inactive_devices(
        db: Session,
        days: int = 30,
    ) -> int:
        """Remove inactive device tokens older than N days"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        count = db.query(DeviceToken).filter(
            DeviceToken.is_active == False,
            DeviceToken.last_registered_at < cutoff,
        ).delete()
        db.commit()
        return count
