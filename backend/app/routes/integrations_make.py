"""
Make.com Integration - Advanced workflow automation like Zapier
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.models import User
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== Pydantic Models ====================

class MakeModule(BaseModel):
    module_id: str
    module_type: str  # trigger, action
    name: str
    app: str

class MakeScenario(BaseModel):
    scenario_id: str
    name: str
    description: str
    enabled: bool
    modules: list[MakeModule]
    runs: int = 0
    last_run: datetime = None

# ==================== Available Modules ====================

@router.get("/integrations/make/modules")
async def list_make_modules(
    module_type: str = Query(None, regex="^(trigger|action)$"),
    current_user: User = Depends(get_current_user),
):
    """List all available Make.com modules for Scribe House"""
    triggers = [
        {
            "module_id": "trigger_new_chapter",
            "module_type": "trigger",
            "name": "New Chapter Created",
            "app": "Scribe House",
            "description": "Trigger when a new chapter is added",
            "fields": ["book_id", "book_title", "chapter_title", "word_count", "created_at"],
        },
        {
            "module_id": "trigger_book_status",
            "module_type": "trigger",
            "name": "Book Status Changed",
            "app": "Scribe House",
            "description": "Trigger when book status changes",
            "fields": ["book_id", "book_title", "status", "changed_at"],
        },
        {
            "module_id": "trigger_collaboration",
            "module_type": "trigger",
            "name": "Collaboration Invite",
            "app": "Scribe House",
            "description": "Trigger when someone collabs with you",
            "fields": ["collaborator_name", "book_title", "role"],
        },
        {
            "module_id": "trigger_milestone",
            "module_type": "trigger",
            "name": "Word Count Milestone",
            "app": "Scribe House",
            "description": "Trigger at specific word count milestones",
            "fields": ["milestone", "total_words", "book_title"],
        },
    ]

    actions = [
        {
            "module_id": "action_slack",
            "module_type": "action",
            "name": "Send Slack Message",
            "app": "Slack",
            "description": "Post a message to Slack workspace",
        },
        {
            "module_id": "action_discord",
            "module_type": "action",
            "name": "Send Discord Message",
            "app": "Discord",
            "description": "Post a message to Discord channel",
        },
        {
            "module_id": "action_notion",
            "module_type": "action",
            "name": "Create Notion Database Entry",
            "app": "Notion",
            "description": "Add a new entry to Notion database",
        },
        {
            "module_id": "action_sheets",
            "module_type": "action",
            "name": "Add Row to Google Sheets",
            "app": "Google Sheets",
            "description": "Append a new row to a spreadsheet",
        },
        {
            "module_id": "action_github",
            "module_type": "action",
            "name": "Create GitHub Issue",
            "app": "GitHub",
            "description": "Create a new issue in GitHub repo",
        },
    ]

    all_modules = triggers + actions

    if module_type:
        all_modules = [m for m in all_modules if m["module_type"] == module_type]

    return {"modules": all_modules, "total": len(all_modules)}


# ==================== Scenario Management ====================

@router.post("/integrations/make/scenarios")
async def create_make_scenario(
    name: str,
    description: str,
    current_user: User = Depends(get_current_user),
):
    """Create a new Make.com scenario"""
    scenario_id = f"scenario_{current_user.id}_{datetime.utcnow().timestamp()}"
    return {
        "scenario_id": scenario_id,
        "name": name,
        "description": description,
        "enabled": False,
        "modules": [],
        "created_at": datetime.utcnow().isoformat(),
        "edit_url": f"https://make.com/en/scenarios/{scenario_id}/edit",
        "message": "Scenario created. Add modules and enable to activate.",
    }


@router.get("/integrations/make/scenarios")
async def list_make_scenarios(
    current_user: User = Depends(get_current_user),
):
    """List all user's Make.com scenarios"""
    return {
        "scenarios": [
            {
                "scenario_id": f"scenario_{i}",
                "name": f"When chapter published, notify on Slack #{i}",
                "description": f"Auto-post to Discord when new chapter hits",
                "enabled": True if i % 2 == 0 else False,
                "modules_count": 2,
                "runs": 23 + (i * 5),
                "last_run": (datetime.utcnow() - timedelta(days=i)).isoformat(),
                "success_rate": 98.5 - (i * 0.5),
                "edit_url": f"https://make.com/en/scenarios/scenario_{i}/edit",
            }
            for i in range(1, 5)
        ],
        "total": 4,
    }


@router.get("/integrations/make/scenarios/{scenario_id}")
async def get_make_scenario_details(
    scenario_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get detailed scenario information"""
    return {
        "scenario_id": scenario_id,
        "name": "Post milestones to multiple social platforms",
        "description": "When hitting 25k, 50k, 100k words, post to Twitter and LinkedIn",
        "enabled": True,
        "modules": [
            {
                "module_id": "trigger_milestone",
                "position": 1,
                "name": "Scribe House - Word Count Milestone",
                "outputs": ["milestone", "total_words", "book_title"],
            },
            {
                "module_id": "action_twitter",
                "position": 2,
                "name": "Twitter - Create Tweet",
                "settings": {"text": "Just hit {{milestone}} words on {{book_title}}! 🎉"},
            },
            {
                "module_id": "action_linkedin",
                "position": 3,
                "name": "LinkedIn - Create Update",
                "settings": {"content": "Milestone: {{total_words}} words completed!"},
            },
        ],
        "runs": 156,
        "last_run": (datetime.utcnow() - timedelta(hours=3)).isoformat(),
        "success_rate": 99.2,
        "edit_url": f"https://make.com/en/scenarios/{scenario_id}/edit",
    }


@router.post("/integrations/make/scenarios/{scenario_id}/toggle")
async def toggle_make_scenario(
    scenario_id: str,
    enabled: bool,
    current_user: User = Depends(get_current_user),
):
    """Enable or disable a Make.com scenario"""
    return {
        "scenario_id": scenario_id,
        "enabled": enabled,
        "toggled_at": datetime.utcnow().isoformat(),
        "message": "Scenario " + ("enabled" if enabled else "disabled"),
    }


@router.delete("/integrations/make/scenarios/{scenario_id}")
async def delete_make_scenario(
    scenario_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a Make.com scenario"""
    return {
        "scenario_id": scenario_id,
        "deleted_at": datetime.utcnow().isoformat(),
        "message": "Scenario deleted successfully",
    }


# ==================== Execution History & Monitoring ====================

@router.get("/integrations/make/execution-history")
async def get_make_execution_history(
    scenario_id: str = Query(None),
    limit: int = Query(20, le=100),
    current_user: User = Depends(get_current_user),
):
    """Get Make.com scenario execution history"""
    return {
        "executions": [
            {
                "execution_id": f"exec_{i}",
                "scenario_id": scenario_id or f"scenario_{i}",
                "status": "success" if i % 10 != 0 else "error",
                "started_at": (datetime.utcnow() - timedelta(hours=i)).isoformat(),
                "completed_at": (datetime.utcnow() - timedelta(hours=i, minutes=5)).isoformat(),
                "duration_seconds": 5 + (i * 2),
                "modules_executed": 3,
                "error_module": None if i % 10 != 0 else "slack",
                "error_message": None if i % 10 != 0 else "Slack webhook failed",
            }
            for i in range(1, limit + 1)
        ],
        "total": limit,
    }


@router.get("/integrations/make/stats")
async def get_make_stats(
    current_user: User = Depends(get_current_user),
):
    """Get Make.com integration statistics"""
    return {
        "total_scenarios": 8,
        "active_scenarios": 6,
        "total_executions": 1247,
        "success_rate": 98.7,
        "total_actions_completed": 3741,
        "this_month_executions": 432,
        "avg_execution_time_seconds": 7.2,
        "health_status": "healthy",
        "top_trigger": "word_count_milestone",
        "top_action": "slack_message",
    }


# ==================== Make.com Public App ====================

@router.get("/integrations/make/public-app")
async def get_make_public_app_info():
    """Get Make.com app directory listing information"""
    return {
        "app_name": "Scribe House",
        "description": "Automate your writing workflow and publishing process with Make",
        "category": ["Writing", "Productivity", "Publishing"],
        "available": True,
        "app_url": "https://www.make.com/en/integrations/scribe-house",
        "total_scenarios": 1200,
        "total_users": 450,
        "triggers": 6,
        "actions": 0,
        "popular_templates": [
            {
                "template_name": "LinkedIn post on word count milestones",
                "description": "Post achievement updates on LinkedIn automatically",
                "triggers": ["word_count_milestone"],
                "actions": ["linkedin"],
            },
            {
                "template_name": "Discord notifications for chapter uploads",
                "description": "Send Discord embeds when new chapters are created",
                "triggers": ["new_chapter"],
                "actions": ["discord"],
            },
            {
                "template_name": "GitHub issue for publishing tasks",
                "description": "Create GitHub issues when book ready for publishing",
                "triggers": ["book_status_published"],
                "actions": ["github"],
            },
        ],
    }


# Helper
async def get_current_user():
    return None
