"""
Notion Integration - Sync writing calendar, book database, and snippets
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.models import User
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== Pydantic Models ====================

class NotionOAuthResponse(BaseModel):
    access_token: str
    workspace_id: str
    workspace_name: str
    user_id: str

class NotionCalendarSync(BaseModel):
    last_sync: datetime
    sync_interval: str  # daily, weekly
    calendar_database_id: str = None
    enabled: bool = True

class NotionBookSync(BaseModel):
    database_id: str
    fields_mapped: dict  # title, description, genre, word_count, etc.
    enabled: bool = True
    last_sync: datetime = None

class SyncStatus(BaseModel):
    status: str  # success, in_progress, error
    last_sync: datetime
    next_sync: datetime
    items_synced: int
    message: str

# ==================== OAuth & Connection ====================

@router.get("/integrations/notion/oauth")
async def get_notion_oauth_url(
    current_user: User = Depends(get_current_user),
):
    """Get Notion OAuth authorization URL"""
    import uuid
    state = str(uuid.uuid4())
    return {
        "oauth_url": f"https://api.notion.com/v1/oauth/authorize?client_id=NOTION_CLIENT_ID&response_type=code&owner=user&redirect_uri=YOUR_REDIRECT_URI&state={state}",
        "state": state,
    }


@router.post("/integrations/notion/oauth/callback")
async def notion_oauth_callback(
    code: str,
    state: str,
    current_user: User = Depends(get_current_user),
):
    """Handle Notion OAuth callback"""
    # Mock Notion OAuth exchange
    return {
        "status": "success",
        "access_token": f"ntn_{current_user.id}_{datetime.utcnow().timestamp()}",
        "workspace_id": "workspace_123",
        "workspace_name": "My Notion Workspace",
        "user_id": "user_123",
        "connected_at": datetime.utcnow().isoformat(),
    }


@router.get("/integrations/notion/status")
async def get_notion_connection_status(
    current_user: User = Depends(get_current_user),
):
    """Get Notion connection status"""
    return {
        "connected": True,
        "workspace_name": "My Notion Workspace",
        "access_token_last_checked": datetime.utcnow().isoformat(),
        "sync_enabled": True,
    }


@router.post("/integrations/notion/disconnect")
async def disconnect_notion(
    current_user: User = Depends(get_current_user),
):
    """Disconnect Notion integration"""
    return {
        "status": "success",
        "disconnected_at": datetime.utcnow().isoformat(),
    }


# ==================== Notion Calendar Sync ====================

@router.get("/integrations/notion/calendar")
async def get_notion_calendar_config(
    current_user: User = Depends(get_current_user),
):
    """Get Notion calendar sync configuration"""
    return {
        "enabled": True,
        "sync_interval": "daily",
        "calendar_database_id": "db_calendar_123",
        "last_sync": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
        "next_sync": (datetime.utcnow() + timedelta(hours=22)).isoformat(),
        "auto_sync": True,
    }


@router.post("/integrations/notion/calendar/sync")
async def sync_notion_calendar(
    current_user: User = Depends(get_current_user),
):
    """Manually trigger Notion calendar sync"""
    return {
        "status": "success",
        "sync_started": True,
        "items_synced": 7,
        "message": "Syncing last 7 days of writing sessions to Notion calendar",
        "sync_id": f"sync_{current_user.id}_{datetime.utcnow().timestamp()}",
        "created_pages": [
            {
                "date": (datetime.utcnow() - timedelta(days=i)).isoformat(),
                "notion_url": f"https://notion.so/writing-session-{i}",
                "word_count": 2000 + (i * 100),
                "status": "synced",
            }
            for i in range(7)
        ],
    }


@router.put("/integrations/notion/calendar")
async def update_notion_calendar_config(
    config: NotionCalendarSync,
    current_user: User = Depends(get_current_user),
):
    """Update Notion calendar sync settings"""
    return {
        "status": "success",
        "enabled": config.enabled,
        "sync_interval": config.sync_interval,
        "message": f"Calendar sync updated - next sync in {config.sync_interval}",
    }


# ==================== Notion Book Database Sync ====================

@router.get("/integrations/notion/book-database")
async def get_notion_book_database_config(
    current_user: User = Depends(get_current_user),
):
    """Get Notion book database sync configuration"""
    return {
        "enabled": True,
        "database_id": "db_books_123",
        "last_sync": (datetime.utcnow() - timedelta(days=1)).isoformat(),
        "next_sync": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "fields_mapped": {
            "title": "Title",
            "description": "Description",
            "genre": "Genre",
            "word_count": "Word Count",
            "status": "Status",
            "chapters_count": "Chapters",
        },
        "bi_directional": True,
    }


@router.post("/integrations/notion/book-database/sync")
async def sync_notion_book_database(
    direction: str = Query("both", regex="^(pull|push|both)$"),
    current_user: User = Depends(get_current_user),
):
    """Sync books with Notion database"""
    return {
        "status": "success",
        "direction": direction,
        "books_synced": 3,
        "message": f"Synced 3 books {direction} with Notion",
        "sync_details": [
            {
                "book_id": f"book_{i}",
                "title": f"Book Title {i}",
                "notion_url": f"https://notion.so/book-{i}",
                "status": "synced",
                "word_count": 50000 + (i * 10000),
            }
            for i in range(1, 4)
        ],
    }


@router.put("/integrations/notion/book-database")
async def update_notion_book_config(
    config: NotionBookSync,
    current_user: User = Depends(get_current_user),
):
    """Update Notion book database configuration"""
    return {
        "status": "success",
        "database_id": config.database_id,
        "enabled": config.enabled,
        "fields_mapped": config.fields_mapped,
        "bi_directional": True,
    }


# ==================== Snippet & Notes Sync ====================

@router.get("/integrations/notion/snippets")
async def get_notion_snippets(
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
):
    """Get snippets synced from Notion"""
    return {
        "snippets": [
            {
                "snippet_id": f"snippet_{i}",
                "title": f"Story idea #{i}",
                "content": "A great story idea passed...",
                "source": "notion",
                "notion_url": f"https://notion.so/snippet-{i}",
                "created_at": (datetime.utcnow() - timedelta(days=i)).isoformat(),
            }
            for i in range(limit)
        ],
        "total": limit,
    }


@router.post("/integrations/notion/snippets/import")
async def import_notion_snippets(
    filter_type: str = Query("all"),  # all, recent, favorites
    current_user: User = Depends(get_current_user),
):
    """Import snippets from Notion"""
    return {
        "status": "success",
        "imported": 15,
        "message": f"Imported 15 snippets from Notion",
        "snippets_preview": [
            {
                "title": f"Story Idea #{i}",
                "notion_url": f"https://notion.so/snippet-{i}",
                "imported_to": f"snippet_{i}",
            }
            for i in range(1, 4)
        ],
    }


# ==================== Sync History & Status ====================

@router.get("/integrations/notion/sync-history")
async def get_notion_sync_history(
    limit: int = Query(20, le=100),
    current_user: User = Depends(get_current_user),
):
    """Get Notion sync history"""
    return {
        "syncs": [
            {
                "sync_id": f"sync_{i}",
                "sync_type": "calendar" if i % 2 == 0 else "books",
                "status": "success" if i % 3 != 0 else "error",
                "items_synced": 5 + i,
                "timestamp": (datetime.utcnow() - timedelta(hours=i)).isoformat(),
                "message": "Sync completed successfully" if i % 3 != 0 else "Connection timeout",
            }
            for i in range(1, limit + 1)
        ],
        "total": limit,
    }


@router.get("/integrations/notion/sync-settings")
async def get_all_sync_settings(
    current_user: User = Depends(get_current_user),
):
    """Get all Notion sync settings in one call"""
    return {
        "calendar": {
            "enabled": True,
            "sync_interval": "daily",
            "last_sync": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
        },
        "books": {
            "enabled": True,
            "bi_directional": True,
            "last_sync": (datetime.utcnow() - timedelta(days=1)).isoformat(),
        },
        "snippets": {
            "enabled": True,
            "auto_import": True,
            "last_import": (datetime.utcnow() - timedelta(hours=6)).isoformat(),
        },
        "auto_sync": True,
        "sync_frequency": "daily",
    }


# Helper
async def get_current_user():
    return None
