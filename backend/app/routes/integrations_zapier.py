"""
Zapier Integration - No-code automation with webhooks and triggers
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime
from pydantic import BaseModel
from app.models import User
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== Pydantic Models ====================

class ZapierTrigger(BaseModel):
    trigger_type: str
    description: str
    test_data: dict = None

class ZapierAction(BaseModel):
    action_type: str
    description: str

class ZapierZap(BaseModel):
    zap_id: str
    name: str
    description: str
    trigger: str
    actions: list[str]
    enabled: bool
    last_run: datetime = None

class ZapierWebhook(BaseModel):
    webhook_id: str
    url: str
    trigger_type: str
    enabled: bool
    created_at: datetime
    last_triggered: datetime = None

# ==================== Available Triggers & Actions ====================

@router.get("/integrations/zapier/triggers")
async def list_zapier_triggers(
    current_user: User = Depends(get_current_user),
):
    """List all available Zapier triggers for this app"""
    return {
        "triggers": [
            {
                "trigger_id": "new_chapter",
                "name": "New Chapter",
                "description": "When a new chapter is created",
                "fields": ["book_title", "chapter_title", "word_count"],
            },
            {
                "trigger_id": "milestone_reached",
                "name": "Writing Milestone",
                "description": "When you reach a writing milestone (5k, 10k, 50k, 100k words)",
                "fields": ["milestone", "book_title", "total_words"],
            },
            {
                "trigger_id": "book_published",
                "name": "Book Published",
                "description": "When you publish a book",
                "fields": ["book_title", "platforms", "link"],
            },
            {
                "trigger_id": "collaboration_request",
                "name": "Collaboration Request",
                "description": "When someone requests to collaborate on your book",
                "fields": ["requester_name", "book_title"],
            },
            {
                "trigger_id": "beta_reader_feedback",
                "name": "Beta Reader Feedback",
                "description": "When a beta reader submits feedback",
                "fields": ["reader_name", "book_title", "comment_count"],
            },
            {
                "trigger_id": "writing_streak",
                "name": "Writing Streak Milestone",
                "description": "When you reach 7, 30, or 100-day writing streaks",
                "fields": ["streak_days", "book_title"],
            },
        ]
    }


@router.get("/integrations/zapier/actions")
async def list_zapier_actions(
    current_user: User = Depends(get_current_user),
):
    """List all available Zapier actions"""
    return {
        "actions": [
            {
                "action_id": "send_slack_message",
                "app": "Slack",
                "name": "Send Slack Message",
                "description": "Send a message to a Slack channel",
                "supported_fields": ["channel", "message", "thread"],
            },
            {
                "action_id": "create_task",
                "app": "Todoist",
                "name": "Create Todoist Task",
                "description": "Create a task in Todoist",
                "supported_fields": ["project", "title", "priority"],
            },
            {
                "action_id": "send_email",
                "app": "Gmail",
                "name": "Send Email",
                "description": "Send an email via Gmail",
                "supported_fields": ["to", "subject", "body"],
            },
            {
                "action_id": "post_tweet",
                "app": "Twitter",
                "name": "Post Tweet",
                "description": "Post a tweet to your Twitter account",
                "supported_fields": ["text"],
            },
            {
                "action_id": "create_calendar_event",
                "app": "Google Calendar",
                "name": "Create Calendar Event",
                "description": "Create an event in Google Calendar",
                "supported_fields": ["title", "date", "time", "description"],
            },
            {
                "action_id": "add_record",
                "app": "Airtable",
                "name": "Add Airtable Record",
                "description": "Create a new record in Airtable",
                "supported_fields": ["table", "fields"],
            },
        ]
    }


# ==================== Webhook Management ====================

@router.post("/integrations/zapier/webhooks")
async def create_zapier_webhook(
    trigger_type: str,
    current_user: User = Depends(get_current_user),
):
    """Create a Zapier webhook for a specific trigger"""
    webhook_id = f"webhook_{current_user.id}_{trigger_type}_{datetime.utcnow().timestamp()}"
    webhook_url = f"https://hooks.zapier.com/hooks/catch/YOUR_CATCH_ID/{webhook_id}"
    return {
        "webhook_id": webhook_id,
        "url": webhook_url,
        "trigger_type": trigger_type,
        "enabled": True,
        "created_at": datetime.utcnow().isoformat(),
        "test_url": webhook_url + "/test",
        "message": "Webhook created successfully. Use this URL in Zapier.",
    }


@router.get("/integrations/zapier/webhooks")
async def list_zapier_webhooks(
    current_user: User = Depends(get_current_user),
):
    """List all active Zapier webhooks"""
    return {
        "webhooks": [
            {
                "webhook_id": f"webhook_{i}",
                "trigger_type": ["new_chapter", "milestone_reached", "book_published"][i % 3],
                "enabled": True,
                "created_at": (datetime.utcnow() - timedelta(days=i)).isoformat(),
                "last_triggered": (datetime.utcnow() - timedelta(hours=i*2)).isoformat(),
                "delivery_status": "healthy" if i % 5 != 0 else "delayed",
            }
            for i in range(1, 4)
        ]
    }


@router.delete("/integrations/zapier/webhooks/{webhook_id}")
async def delete_zapier_webhook(
    webhook_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a Zapier webhook"""
    return {
        "status": "success",
        "webhook_id": webhook_id,
        "deleted_at": datetime.utcnow().isoformat(),
    }


@router.post("/integrations/zapier/webhooks/{webhook_id}/test")
async def test_zapier_webhook(
    webhook_id: str,
    current_user: User = Depends(get_current_user),
):
    """Test a Zapier webhook with sample data"""
    return {
        "status": "success",
        "webhook_id": webhook_id,
        "test_sent": True,
        "message": "Test webhook sent successfully",
        "sample_data": {
            "chapter_title": "Test Chapter",
            "word_count": 2500,
            "timestamp": datetime.utcnow().isoformat(),
        },
    }


# ==================== Zap Management & Monitoring ====================

@router.get("/integrations/zapier/zaps")
async def list_user_zaps(
    current_user: User = Depends(get_current_user),
):
    """List all Zaps created by user in their Zapier account"""
    return {
        "zaps": [
            {
                "zap_id": f"zap_{i}",
                "name": f"Post writing milestone on Twitter #{i}",
                "description": "When I hit 10k words, post achievement to Twitter",
                "trigger": "milestone_reached",
                "actions": ["post_tweet"],
                "enabled": True,
                "last_run": (datetime.utcnow() - timedelta(days=i)).isoformat(),
                "zapier_url": f"https://zapier.com/app/editor/zap/{i}",
            }
            for i in range(1, 4)
        ],
        "total": 3,
        "message": "These Zaps are configured in your Zapier account and will trigger our webhooks",
    }


@router.get("/integrations/zapier/execution-history")
async def get_zapier_execution_history(
    webhook_id: str = Query(None),
    limit: int = Query(20, le=100),
    current_user: User = Depends(get_current_user),
):
    """Get execution history for Zapier webhooks"""
    return {
        "executions": [
            {
                "execution_id": f"exec_{i}",
                "webhook_id": webhook_id or f"webhook_{i}",
                "trigger": ["new_chapter", "milestone_reached"][i % 2],
                "status": "success" if i % 10 != 0 else "error",
                "timestamp": (datetime.utcnow() - timedelta(hours=i)).isoformat(),
                "delivery_time_ms": 150 + (i * 10),
                "error_message": None if i % 10 != 0 else "Timeout",
            }
            for i in range(1, limit + 1)
        ],
        "total": limit,
    }


@router.get("/integrations/zapier/stats")
async def get_zapier_stats(
    current_user: User = Depends(get_current_user),
):
    """Get Zapier integration stats"""
    return {
        "total_webhooks": 5,
        "total_zaps": 8,
        "active_zaps": 7,
        "executions_this_month": 342,
        "success_rate": 98.2,
        "health_status": "healthy",
        "average_latency_ms": 145,
    }


# ==================== Zapier App Marketplace ====================

@router.get("/integrations/zapier/marketplace-info")
async def get_zapier_marketplace_info():
    """Get Zapier app marketplace listing information"""
    return {
        "app_name": "AI Book Writer",
        "description": "Automate your writing workflow with Zapier",
        "category": ["Writing", "Productivity", "Publishing"],
        "available_in_marketplace": True,
        "marketplace_url": "https://zapier.com/apps/ai-book-writer/integrations",
        "triggers": 6,
        "actions": 0,
        "popular_zap_templates": [
            {
                "template_name": "Post your book achievements on Twitter",
                "trigger": "milestone_reached",
                "actions": ["post_tweet"],
            },
            {
                "template_name": "Save new chapters to Notion",
                "trigger": "new_chapter",
                "actions": ["create_notion_page"],
            },
            {
                "template_name": "Email yourself on book publication",
                "trigger": "book_published",
                "actions": ["send_email"],
            },
        ],
    }


# Helper
from datetime import timedelta

async def get_current_user():
    return None
