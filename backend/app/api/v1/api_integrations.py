"""API integration routes."""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth import get_current_user
from app.models.user import User
from app.services.api_integrations import (
    APIKeyService,
    WebhookService,
    IntegrationAuthService,
    NotionSyncService,
    GoogleDocsSyncService,
    ZapierService,
    ExportTemplateService,
)
from app.schemas.api_integrations import (
    APIKeyCreate,
    APIKeyResponse,
    WebhookCreate,
    WebhookResponse,
    IntegrationStatus,
)


router = APIRouter(prefix="/integrations", tags=["integrations"])


# ===== API KEYS =====

@router.post("/api-keys", response_model=dict)
def create_api_key(data: APIKeyCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create new API key."""
    api_key, plaintext_key = APIKeyService.create_key(db, current_user.id, data)
    return {
        "id": api_key.id,
        "key": plaintext_key,  # Only shown once
        "prefix": api_key.key_prefix,
        "created_at": api_key.created_at,
    }


@router.get("/api-keys", response_model=list)
def list_api_keys(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List all API keys for user."""
    keys = APIKeyService.list_keys(db, current_user.id)
    return [
        {
            "id": k.id,
            "name": k.name,
            "prefix": k.key_prefix,
            "status": k.status,
            "scopes": k.scopes,
            "created_at": k.created_at,
            "last_used_at": k.last_used_at,
        }
        for k in keys
    ]


@router.delete("/api-keys/{key_id}")
def revoke_api_key(key_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Revoke API key."""
    key = db.query(__import__('app.models.api_integrations', fromlist=['APIKey']).APIKey).filter(
        __import__('app.models.api_integrations', fromlist=['APIKey']).APIKey.id == key_id,
        __import__('app.models.api_integrations', fromlist=['APIKey']).APIKey.user_id == current_user.id,
    ).first()
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    APIKeyService.revoke_key(db, key_id)
    return {"status": "revoked"}


# ===== WEBHOOKS =====

@router.post("/webhooks", response_model=WebhookResponse)
def create_webhook(data: WebhookCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create webhook subscription."""
    webhook = WebhookService.create_webhook(db, current_user.id, data)
    return webhook


@router.get("/webhooks", response_model=list)
def list_webhooks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List all webhooks."""
    from app.models.api_integrations import Webhook
    webhooks = db.query(Webhook).filter(Webhook.user_id == current_user.id).all()
    return [
        {
            "id": w.id,
            "url": w.url,
            "events": w.events,
            "is_active": bool(w.is_active),
            "delivery_count": w.delivery_count,
            "failure_count": w.failure_count,
            "created_at": w.created_at,
        }
        for w in webhooks
    ]


@router.patch("/webhooks/{webhook_id}")
def update_webhook(webhook_id: str, data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update webhook."""
    from app.models.api_integrations import Webhook
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.user_id == current_user.id,
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    WebhookService.update_webhook(db, webhook_id, **data)
    return {"status": "updated"}


@router.delete("/webhooks/{webhook_id}")
def delete_webhook(webhook_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete webhook."""
    from app.models.api_integrations import Webhook
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.user_id == current_user.id,
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    WebhookService.delete_webhook(db, webhook_id)
    return {"status": "deleted"}


@router.get("/webhooks/{webhook_id}/deliveries")
def get_webhook_deliveries(webhook_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get webhook delivery history."""
    from app.models.api_integrations import Webhook, WebhookDelivery
    
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.user_id == current_user.id,
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    deliveries = db.query(WebhookDelivery).filter(
        WebhookDelivery.webhook_id == webhook_id
    ).order_by(WebhookDelivery.delivered_at.desc()).limit(50).all()
    
    return [
        {
            "id": d.id,
            "event": d.event,
            "status_code": d.status_code,
            "delivered_at": d.delivered_at,
            "response_time_ms": d.response_time_ms,
        }
        for d in deliveries
    ]


# ===== INTEGRATIONS =====

@router.get("/providers")
def list_providers():
    """List available integration providers."""
    return {
        "providers": [
            {
                "id": "zapier",
                "name": "Zapier",
                "description": "Connect to 1000+ apps",
            },
            {
                "id": "make",
                "name": "Make (formerly Integromat)",
                "description": "Visual automation builder",
            },
            {
                "id": "notion",
                "name": "Notion",
                "description": "Sync to Notion databases",
            },
            {
                "id": "google_docs",
                "name": "Google Docs",
                "description": "Import and sync documents",
            },
            {
                "id": "slack",
                "name": "Slack",
                "description": "Notifications and updates",
            },
            {
                "id": "discord",
                "name": "Discord",
                "description": "Community notifications",
            },
        ]
    }


@router.get("/status")
def get_integration_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get status of all integrations."""
    from app.models.api_integrations import IntegrationAuth
    
    auths = db.query(IntegrationAuth).filter(IntegrationAuth.user_id == current_user.id).all()
    
    return {
        "integrations": [
            {
                "provider": a.provider,
                "is_connected": bool(a.is_active),
                "authorized_at": a.created_at,
                "expires_at": a.oauth_expires_at,
            }
            for a in auths
        ]
    }


# ===== NOTION SYNC =====

@router.post("/notion/sync")
def setup_notion_sync(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Setup Notion sync."""
    auth = IntegrationAuthService.get_auth(db, current_user.id, "notion")
    if not auth:
        raise HTTPException(status_code=400, detail="Notion not authorized")
    
    sync = NotionSyncService.create_sync(db, auth.id, data)
    return {"id": sync.id, "status": "created"}


# ===== EXPORT TEMPLATES =====

@router.post("/export-templates")
def create_export_template(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create export template."""
    template = ExportTemplateService.create_template(
        db, current_user.id,
        name=data.get("name"),
        format=data.get("format"),
        includes=data.get("includes", []),
        filters=data.get("filters", {}),
    )
    return {
        "id": template.id,
        "name": template.name,
        "format": template.format,
    }


@router.get("/export-templates")
def list_export_templates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List export templates."""
    templates = ExportTemplateService.get_templates(db, current_user.id)
    return [
        {
            "id": t.id,
            "name": t.name,
            "format": t.format,
            "includes": t.includes,
            "created_at": t.created_at,
        }
        for t in templates
    ]


# ===== PUBLIC API DOCUMENTATION =====

@router.get("/docs/api")
def get_api_documentation():
    """Get public API documentation."""
    return {
        "version": "v1",
        "base_url": "/api/v1",
        "authentication": {
            "type": "Bearer token",
            "header": "Authorization: Bearer sk_...",
        },
        "endpoints": {
            "books": {
                "GET /books": "List user's books",
                "GET /books/{id}": "Get book details",
                "POST /books": "Create new book",
                "PATCH /books/{id}": "Update book",
            },
            "chapters": {
                "GET /books/{id}/chapters": "List chapters",
                "POST /books/{id}/chapters": "Create chapter",
                "PATCH /chapters/{id}": "Update chapter",
            },
            "events": {
                "GET /events": "List story events",
                "POST /events": "Create event",
                "PATCH /events/{id}": "Update event",
            },
            "comments": {
                "GET /chapters/{id}/comments": "Get comments",
                "POST /chapters/{id}/comments": "Add comment",
            },
        },
        "webhooks": {
            "events": [
                "manuscript.published",
                "chapter.completed",
                "feedback.received",
                "royalty.earned",
            ]
        },
    }
