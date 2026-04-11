"""
Celery tasks for background notification handling.

This module defines asynchronous tasks for:
- Sending push notifications
- Refreshing device tokens
- Syncing notification state
- Cleaning up inactive devices
"""

import logging
from typing import Any, Dict, Optional

from celery import shared_task
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.notification_model import DeviceToken
from app.workers.push_notification_sender import PushNotificationSender

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def send_push_notification(
    self,
    user_id: str,
    title: str,
    body: str,
    notification_type: str,
    data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Asynchronous task to send a push notification.

    Args:
        user_id: ID of the user to notify
        title: Notification title
        body: Notification message
        notification_type: Type of notification
        data: Optional extra data

    Returns:
        Result of the notification send operation
    """
    db = SessionLocal()
    
    try:
        import asyncio
        
        # Create event loop for async operation
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        result = loop.run_until_complete(
            PushNotificationSender.send_notification(
                db,
                user_id,
                title,
                body,
                notification_type,
                data,
            )
        )
        
        loop.close()
        
        logger.info(f"Sent push notification to user {user_id}: {result}")
        return result
        
    except Exception as exc:
        logger.error(f"Failed to send notification: {str(exc)}")
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task(bind=True, max_retries=3)
def send_chapter_update_notification(
    self,
    user_id: str,
    chapter_id: str,
    chapter_title: str,
    editor_name: str,
) -> Dict[str, Any]:
    """Send a chapter update notification asynchronously"""
    db = SessionLocal()
    
    try:
        import asyncio
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        result = loop.run_until_complete(
            PushNotificationSender.send_chapter_update(
                db,
                user_id,
                chapter_id,
                chapter_title,
                editor_name,
            )
        )
        
        loop.close()
        
        logger.info(f"Sent chapter update notification to user {user_id}")
        return result
        
    except Exception as exc:
        logger.error(f"Failed to send chapter notification: {str(exc)}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task(bind=True, max_retries=3)
def send_collaboration_notification(
    self,
    user_id: str,
    book_id: str,
    book_title: str,
    collaborator_name: str,
    action: str,
) -> Dict[str, Any]:
    """Send a collaboration notification asynchronously"""
    db = SessionLocal()
    
    try:
        import asyncio
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        result = loop.run_until_complete(
            PushNotificationSender.send_collaboration_notification(
                db,
                user_id,
                book_id,
                book_title,
                collaborator_name,
                action,
            )
        )
        
        loop.close()
        
        logger.info(f"Sent collaboration notification to user {user_id}")
        return result
        
    except Exception as exc:
        logger.error(f"Failed to send collaboration notification: {str(exc)}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task(bind=True, max_retries=3)
def send_assignment_notification(
    self,
    user_id: str,
    assignment_id: str,
    assignment_title: str,
    classroom_name: str,
    action: str,
) -> Dict[str, Any]:
    """Send an assignment notification asynchronously"""
    db = SessionLocal()
    
    try:
        import asyncio
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        result = loop.run_until_complete(
            PushNotificationSender.send_assignment_notification(
                db,
                user_id,
                assignment_id,
                assignment_title,
                classroom_name,
                action,
            )
        )
        
        loop.close()
        
        logger.info(f"Sent assignment notification to user {user_id}")
        return result
        
    except Exception as exc:
        logger.error(f"Failed to send assignment notification: {str(exc)}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task(bind=True, max_retries=3)
def send_milestone_notification(
    self,
    user_id: str,
    book_id: str,
    book_title: str,
    milestone_name: str,
) -> Dict[str, Any]:
    """Send a milestone notification asynchronously"""
    db = SessionLocal()
    
    try:
        import asyncio
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        result = loop.run_until_complete(
            PushNotificationSender.send_milestone_notification(
                db,
                user_id,
                book_id,
                book_title,
                milestone_name,
            )
        )
        
        loop.close()
        
        logger.info(f"Sent milestone notification to user {user_id}")
        return result
        
    except Exception as exc:
        logger.error(f"Failed to send milestone notification: {str(exc)}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task
def cleanup_inactive_devices() -> Dict[str, Any]:
    """
    Periodic task to clean up inactive device tokens.
    
    Removes device tokens that haven't been active for 30 days.
    """
    db = SessionLocal()
    
    try:
        from datetime import datetime, timedelta
        
        cutoff_date = datetime.utcnow() - timedelta(days=30)
        
        deleted_count = db.query(DeviceToken).filter(
            DeviceToken.updated_at < cutoff_date,
            DeviceToken.is_active == False,
        ).delete()
        
        db.commit()
        
        logger.info(f"Cleaned up {deleted_count} inactive device tokens")
        
        return {
            "success": True,
            "deleted_count": deleted_count,
        }
        
    except Exception as e:
        logger.error(f"Failed to cleanup inactive devices: {str(e)}")
        db.rollback()
        
        return {
            "success": False,
            "error": str(e),
        }
    finally:
        db.close()


@shared_task
def refresh_device_token(user_id: str, old_token: str, new_token: str) -> Dict[str, Any]:
    """
    Task to refresh a device token when the app detects a new one.
    
    Called when Expo generates a new token for a device.
    """
    db = SessionLocal()
    
    try:
        device = db.query(DeviceToken).filter(
            DeviceToken.user_id == user_id,
            DeviceToken.device_token == old_token,
        ).first()
        
        if device:
            device.device_token = new_token
            db.commit()
            
            logger.info(f"Refreshed device token for user {user_id}")
            
            return {
                "success": True,
                "message": "Device token refreshed",
            }
        else:
            logger.warning(f"Device token not found for user {user_id}")
            
            return {
                "success": False,
                "message": "Device token not found",
            }
        
    except Exception as e:
        logger.error(f"Failed to refresh device token: {str(e)}")
        db.rollback()
        
        return {
            "success": False,
            "error": str(e),
        }
    finally:
        db.close()


@shared_task
def sync_notification_state(user_id: str) -> Dict[str, Any]:
    """
    Periodic task to sync notification state for users.
    
    Fetches any undelivered notifications and marks them as delivered.
    """
    db = SessionLocal()
    
    try:
        from app.models.notification_model import Notification
        
        # Get undelivered notifications for the user
        undelivered = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_delivered == False,
        ).all()
        
        # Mark as delivered
        for notification in undelivered:
            notification.is_delivered = True
        
        db.commit()
        
        logger.info(f"Synced {len(undelivered)} notifications for user {user_id}")
        
        return {
            "success": True,
            "synced_count": len(undelivered),
        }
        
    except Exception as e:
        logger.error(f"Failed to sync notification state: {str(e)}")
        db.rollback()
        
        return {
            "success": False,
            "error": str(e),
        }
    finally:
        db.close()
