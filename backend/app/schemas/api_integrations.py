"""Public API integrations."""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from enum import Enum


class IntegrationProvider(str, Enum):
    """Integration provider types."""
    ZAPIER = "zapier"
    MAKE = "make"
    NOTION = "notion"
    GOOGLE_DOCS = "google-docs"
    SCRIVENER = "scrivener"
    SLACK = "slack"
    DISCORD = "discord"
    EMAIL = "email_webhook"


class APIKeyStatus(str, Enum):
    """API key status."""
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"


class WebhookEvent(str, Enum):
    """Webhook events."""
    MANUSCRIPT_PUBLISHED = "manuscript.published"
    CHAPTER_COMPLETED = "chapter.completed"
    FEEDBACK_RECEIVED = "feedback.received"
    COLLABORATION_INVITED = "collaboration.invited"
    BOOK_EXPORTED = "book.exported"
    ROYALTY_EARNED = "royalty.earned"


class APIKeyCreate(BaseModel):
    """Create API key."""
    name: str
    scopes: List[str] = ["read"]  # read, write, admin


class APIKeyResponse(BaseModel):
    """API key response."""
    id: str
    user_id: str
    name: str
    key_prefix: str  # First 8 chars visible
    scopes: List[str]
    status: str
    created_at: str
    last_used_at: Optional[str]
    
    class Config:
        orm_mode = True


class WebhookCreate(BaseModel):
    """Create webhook subscription."""
    url: str
    events: List[str]
    active: bool = True
    headers: Optional[Dict[str, str]] = None  # Custom headers


class WebhookResponse(BaseModel):
    """Webhook subscription response."""
    id: str
    user_id: str
    url: str
    events: List[str]
    active: bool
    retry_count: int
    last_delivery_at: Optional[str]
    created_at: str
    
    class Config:
        orm_mode = True


class WebhookDelivery(BaseModel):
    """Single webhook delivery record."""
    id: str
    webhook_id: str
    event: str
    payload: Dict[str, Any]
    status_code: Optional[int]
    response: Optional[str]
    delivered_at: str


class ZapierAuthCreate(BaseModel):
    """Authorize Zapier integration."""
    oauth_code: str


class NotionSyncCreate(BaseModel):
    """Setup Notion sync."""
    oauth_code: str
    database_id: str  # Notion database to sync to


class GoogleDocsImportCreate(BaseModel):
    """Import from Google Docs."""
    document_id: str
    target_book_id: str
    target_chapter_id: Optional[str]


class ScrivenerImportCreate(BaseModel):
    """Import from Scrivener."""
    file_name: str
    target_book_id: str


class IntegrationList(BaseModel):
    """List of available integrations."""
    provider: str
    name: str
    description: str
    is_connected: bool
    auth_url: Optional[str]
    scopes: List[str]


class IntegrationStatus(BaseModel):
    """Status of integration."""
    provider: str
    is_connected: bool
    authorized_at: Optional[str]
    expires_at: Optional[str]
    refresh_count: int


# ===== API Query Models =====

class BookQuery(BaseModel):
    """Query books via API."""
    limit: int = 10
    offset: int = 0
    status: Optional[str] = None  # draft, in_progress, published
    sort_by: str = "created_at"  # created_at, updated_at, title


class ChapterQuery(BaseModel):
    """Query chapters via API."""
    book_id: str
    limit: int = 50
    offset: int = 0
    include_content: bool = False


class EventQuery(BaseModel):
    """Query events via API."""
    limit: int = 20
    offset: int = 0
    book_ids: Optional[List[str]] = None
    event_types: Optional[List[str]] = None


# ===== Webhook Payload Models =====

class ManuscriptPublishedWebhook(BaseModel):
    """Manuscript published event."""
    event: str = "manuscript.published"
    book_id: str
    title: str
    isbn: Optional[str]
    published_at: str
    platforms: List[str]  # amazon, draft2digital, ingramspark


class ChapterCompletedWebhook(BaseModel):
    """Chapter completed event."""
    event: str = "chapter.completed"
    book_id: str
    chapter_id: str
    chapter_number: int
    word_count: int
    completed_at: str


class FeedbackReceivedWebhook(BaseModel):
    """Feedback received event."""
    event: str = "feedback.received"
    book_id: str
    chapter_id: Optional[str]
    feedback_type: str  # comment, suggestion, edit
    from_user: str
    received_at: str


class RoyaltyEarnedWebhook(BaseModel):
    """Royalty earned event."""
    event: str = "royalty.earned"
    book_id: str
    amount_cents: int
    platform: str
    earned_at: str
