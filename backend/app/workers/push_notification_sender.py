"""
Notification sender service for sending push notifications to mobile devices.

This service handles sending notifications via Expo's push service.
It supports both real notifications (sent to actual devices) and test notifications.
"""

import json
import logging
from typing import Any, Dict, List, Optional

import aiohttp
from sqlalchemy.orm import Session

from app.models.notification_model import Notification, NotificationPreference, DeviceToken
from app.schemas.notification_schema import (
    ChapterUpdateEvent,
    CollaborationEvent,
    AssignmentEvent,
    MilestoneEvent,
)

logger = logging.getLogger(__name__)

# Expo push notification service URL
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class PushNotificationSender:
    """Service for sending push notifications to Expo-registered devices"""

    @staticmethod
    async def send_notification(
        db: Session,
        user_id: str,
        title: str,
        body: str,
        notification_type: str,
        data: Optional[Dict[str, Any]] = None,
        check_preferences: bool = True,
    ) -> Dict[str, Any]:
        """
        Send a push notification to a user's registered devices.

        Args:
            db: Database session
            user_id: ID of the user to notify
            title: Notification title
            body: Notification body/message
            notification_type: Type of notification (chapter_update, collaboration, assignment, milestone)
            data: Optional extra data to include in notification
            check_preferences: If True, check user notification preferences before sending

        Returns:
            Dict with send results (tokens_sent, tokens_failed, expo_response)
        """
        # Check notification preferences if enabled
        if check_preferences:
            prefs = db.query(NotificationPreference).filter(
                NotificationPreference.user_id == user_id
            ).first()
            
            # Only send if user has enabled this notification type
            if prefs and not PushNotificationSender._should_notify(prefs, notification_type):
                logger.info(f"Skipping notification for user {user_id}: disabled in preferences")
                return {"tokens_sent": 0, "tokens_failed": 0, "skipped_by_preference": True}

        # Get active device tokens for the user
        device_tokens = db.query(DeviceToken).filter(
            DeviceToken.user_id == user_id,
            DeviceToken.is_active == True,
        ).all()

        if not device_tokens:
            logger.warning(f"No active device tokens for user {user_id}")
            return {"tokens_sent": 0, "tokens_failed": 0, "no_devices": True}

        # Prepare notification payload
        notification_payload = {
            "to": [token.device_token for token in device_tokens],
            "sound": "default",
            "title": title,
            "body": body,
            "data": {
                "type": notification_type,
                **(data or {}),
            },
            "badge": 1,
            "ttl": 86400,  # 24 hours
        }

        # Send via Expo push service
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    EXPO_PUSH_URL,
                    json=notification_payload,
                    headers={"Accept": "application/json", "Content-Type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as response:
                    result = await response.json()
                    
                    # Track send results
                    tokens_sent = 0
                    tokens_failed = 0
                    
                    if "data" in result and isinstance(result["data"], list):
                        for item in result["data"]:
                            if item.get("status") == "ok":
                                tokens_sent += 1
                            else:
                                tokens_failed += 1
                                logger.warning(
                                    f"Failed to send notification: {item.get('message', 'Unknown error')}"
                                )
                    
                    logger.info(
                        f"Sent notification to {tokens_sent}/{len(device_tokens)} devices for user {user_id}"
                    )
                    
                    return {
                        "tokens_sent": tokens_sent,
                        "tokens_failed": tokens_failed,
                        "expo_response": result,
                    }
            except aiohttp.ClientError as e:
                logger.error(f"Failed to send push notification: {str(e)}")
                return {
                    "tokens_sent": 0,
                    "tokens_failed": len(device_tokens),
                    "error": str(e),
                }

    @staticmethod
    async def send_chapter_update(
        db: Session,
        user_id: str,
        chapter_id: str,
        chapter_title: str,
        editor_name: str,
    ) -> Dict[str, Any]:
        """Send a chapter update notification"""
        return await PushNotificationSender.send_notification(
            db,
            user_id,
            title="Chapter Updated",
            body=f"{editor_name} updated '{chapter_title}'",
            notification_type="chapter_update",
            data={
                "chapter_id": chapter_id,
                "chapter_title": chapter_title,
                "editor_name": editor_name,
            },
        )

    @staticmethod
    async def send_collaboration_notification(
        db: Session,
        user_id: str,
        book_id: str,
        book_title: str,
        collaborator_name: str,
        action: str,  # 'invited', 'commented', 'joined'
    ) -> Dict[str, Any]:
        """Send a collaboration notification"""
        action_text = {
            "invited": "invited you to collaborate",
            "commented": "commented on your project",
            "joined": "joined your project",
        }.get(action, "updated your project")

        return await PushNotificationSender.send_notification(
            db,
            user_id,
            title="Project Collaboration",
            body=f"{collaborator_name} {action_text} on '{book_title}'",
            notification_type="collaboration",
            data={
                "book_id": book_id,
                "book_title": book_title,
                "collaborator_name": collaborator_name,
                "action": action,
            },
        )

    @staticmethod
    async def send_assignment_notification(
        db: Session,
        user_id: str,
        assignment_id: str,
        assignment_title: str,
        classroom_name: str,
        action: str,  # 'assigned', 'graded', 'submitted'
    ) -> Dict[str, Any]:
        """Send an assignment notification"""
        action_text = {
            "assigned": "assigned:",
            "graded": "your submission was graded for",
            "submitted": "submitted for",
        }.get(action, "updated for")

        return await PushNotificationSender.send_notification(
            db,
            user_id,
            title="Assignment Update",
            body=f"{action_text} {assignment_title} in {classroom_name}",
            notification_type="assignment",
            data={
                "assignment_id": assignment_id,
                "assignment_title": assignment_title,
                "classroom_name": classroom_name,
                "action": action,
            },
        )

    @staticmethod
    async def send_milestone_notification(
        db: Session,
        user_id: str,
        book_id: str,
        book_title: str,
        milestone_name: str,
    ) -> Dict[str, Any]:
        """Send a milestone achievement notification"""
        return await PushNotificationSender.send_notification(
            db,
            user_id,
            title="Milestone Achieved!",
            body=f"You reached '{milestone_name}' on '{book_title}'",
            notification_type="milestone",
            data={
                "book_id": book_id,
                "book_title": book_title,
                "milestone_name": milestone_name,
            },
        )

    @staticmethod
    async def send_test_notification(
        db: Session,
        user_id: str,
    ) -> Dict[str, Any]:
        """Send a test notification to verify device registration"""
        return await PushNotificationSender.send_notification(
            db,
            user_id,
            title="Test Notification",
            body="This is a test notification to verify your device is registered.",
            notification_type="system",
            check_preferences=False,
        )

    @staticmethod
    def _should_notify(prefs: NotificationPreference, notification_type: str) -> bool:
        """Check if user preferences allow sending this notification type"""
        if not prefs.notifications_enabled:
            return False

        type_map = {
            "chapter_update": prefs.chapter_updates_enabled,
            "collaboration": prefs.collaboration_enabled,
            "assignment": prefs.assignment_enabled,
            "milestone": prefs.milestone_enabled,
            "system": True,  # System notifications always allowed
        }

        return type_map.get(notification_type, False)


class BulkNotificationSender:
    """Service for sending bulk notifications to multiple users"""

    @staticmethod
    async def send_to_users(
        db: Session,
        user_ids: List[str],
        title: str,
        body: str,
        notification_type: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Send the same notification to multiple users"""
        results = {
            "total_users": len(user_ids),
            "successful": 0,
            "failed": 0,
            "details": [],
        }

        for user_id in user_ids:
            try:
                result = await PushNotificationSender.send_notification(
                    db,
                    user_id,
                    title,
                    body,
                    notification_type,
                    data,
                )
                
                if result.get("tokens_sent", 0) > 0:
                    results["successful"] += 1
                else:
                    results["failed"] += 1
                    
                results["details"].append({"user_id": user_id, "result": result})
            except Exception as e:
                logger.error(f"Error sending notification to user {user_id}: {str(e)}")
                results["failed"] += 1

        return results
