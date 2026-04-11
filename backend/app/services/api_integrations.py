"""API integration services."""

import secrets
import hashlib
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from uuid import uuid4
from app.models.api_integrations import (
    APIKey,
    Webhook,
    WebhookDelivery,
    IntegrationAuth,
    NotionSync,
    GoogleDocsSync,
    ZapierAction,
    ExportTemplate,
)
from app.schemas.api_integrations import (
    APIKeyCreate,
    WebhookCreate,
    ZapierAuthCreate,
    NotionSyncCreate,
)


class APIKeyService:
    """API key management."""
    
    @staticmethod
    def create_key(db: Session, user_id: str, data: APIKeyCreate) -> tuple:
        """Create new API key. Returns (APIKey, plaintext_key)."""
        # Generate key
        plaintext = f"sk_{secrets.token_urlsafe(32)}"
        key_hash = hashlib.sha256(plaintext.encode()).hexdigest()
        key_prefix = plaintext[:8]
        
        api_key = APIKey(
            id=str(uuid4()),
            user_id=user_id,
            name=data.name,
            key_hash=key_hash,
            key_prefix=key_prefix,
            scopes=data.scopes,
        )
        db.add(api_key)
        db.commit()
        
        return api_key, plaintext
    
    @staticmethod
    def verify_key(db: Session, plaintext_key: str) -> APIKey:
        """Verify API key and increment usage."""
        key_hash = hashlib.sha256(plaintext_key.encode()).hexdigest()
        api_key = db.query(APIKey).filter(APIKey.key_hash == key_hash).first()
        
        if api_key and api_key.status == "active":
            if api_key.expires_at and datetime.utcnow() > api_key.expires_at:
                api_key.status = "expired"
            else:
                api_key.last_used_at = datetime.utcnow()
                api_key.use_count += 1
                db.commit()
        
        return api_key
    
    @staticmethod
    def revoke_key(db: Session, key_id: str) -> APIKey:
        """Revoke API key."""
        api_key = db.query(APIKey).filter(APIKey.id == key_id).first()
        if api_key:
            api_key.status = "revoked"
            api_key.revoked_at = datetime.utcnow()
            db.commit()
        return api_key
    
    @staticmethod
    def list_keys(db: Session, user_id: str) -> list:
        """List all keys for user."""
        return db.query(APIKey).filter(APIKey.user_id == user_id).all()


class WebhookService:
    """Webhook management and delivery."""
    
    @staticmethod
    def create_webhook(db: Session, user_id: str, data: WebhookCreate) -> Webhook:
        """Create webhook subscription."""
        webhook = Webhook(
            id=str(uuid4()),
            user_id=user_id,
            url=data.url,
            events=data.events,
            headers=data.headers or {},
            is_active=1 if data.active else 0,
        )
        db.add(webhook)
        db.commit()
        return webhook
    
    @staticmethod
    def trigger_event(db: Session, user_id: str, event: str, payload: dict) -> int:
        """Trigger webhook event for all matching webhooks."""
        webhooks = db.query(Webhook).filter(
            Webhook.user_id == user_id,
            Webhook.is_active == 1,
        ).all()
        
        delivered = 0
        for webhook in webhooks:
            if event in webhook.events:
                # Create delivery record
                delivery = WebhookDelivery(
                    id=str(uuid4()),
                    webhook_id=webhook.id,
                    event=event,
                    payload=payload,
                    attempt_number=1,
                )
                db.add(delivery)
                
                # Update webhook stats
                webhook.delivery_count += 1
                
                # TODO: Actually POST to webhook URL (async job)
                
                delivered += 1
        
        db.commit()
        return delivered
    
    @staticmethod
    def update_webhook(db: Session, webhook_id: str, **kwargs) -> Webhook:
        """Update webhook."""
        webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
        if webhook:
            for key, val in kwargs.items():
                if hasattr(webhook, key):
                    setattr(webhook, key, val)
            webhook.updated_at = datetime.utcnow()
            db.commit()
        return webhook
    
    @staticmethod
    def delete_webhook(db: Session, webhook_id: str):
        """Delete webhook."""
        webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
        if webhook:
            db.delete(webhook)
            db.commit()


class IntegrationAuthService:
    """Integration authorization."""
    
    @staticmethod
    def create_or_update_auth(db: Session, user_id: str, provider: str, **oauth_data) -> IntegrationAuth:
        """Create or update integration auth."""
        auth = db.query(IntegrationAuth).filter(
            IntegrationAuth.user_id == user_id,
            IntegrationAuth.provider == provider,
        ).first()
        
        if not auth:
            auth = IntegrationAuth(
                id=str(uuid4()),
                user_id=user_id,
                provider=provider,
            )
        
        # Update OAuth data
        for key, val in oauth_data.items():
            if hasattr(auth, key):
                setattr(auth, key, val)
        
        auth.is_active = 1
        auth.updated_at = datetime.utcnow()
        db.commit()
        
        return auth
    
    @staticmethod
    def get_auth(db: Session, user_id: str, provider: str) -> IntegrationAuth:
        """Get integration auth."""
        return db.query(IntegrationAuth).filter(
            IntegrationAuth.user_id == user_id,
            IntegrationAuth.provider == provider,
        ).first()
    
    @staticmethod
    def revoke_auth(db: Session, user_id: str, provider: str):
        """Revoke integration."""
        auth = IntegrationAuthService.get_auth(db, user_id, provider)
        if auth:
            auth.is_active = 0
            db.commit()


class NotionSyncService:
    """Notion sync management."""
    
    @staticmethod
    def create_sync(db: Session, auth_id: str, data: NotionSyncCreate) -> NotionSync:
        """Create Notion sync."""
        sync = NotionSync(
            id=str(uuid4()),
            auth_id=auth_id,
            notion_database_id=data.database_id,
        )
        db.add(sync)
        db.commit()
        return sync
    
    @staticmethod
    def update_sync_status(db: Session, sync_id: str, record_count: int = 0):
        """Update sync status."""
        sync = db.query(NotionSync).filter(NotionSync.id == sync_id).first()
        if sync:
            sync.last_sync_at = datetime.utcnow()
            sync.synced_records_count = record_count
            db.commit()


class GoogleDocsSyncService:
    """Google Docs sync."""
    
    @staticmethod
    def create_sync(db: Session, auth_id: str, document_id: str, book_id: str) -> GoogleDocsSync:
        """Create Google Docs sync."""
        sync = GoogleDocsSync(
            id=str(uuid4()),
            auth_id=auth_id,
            document_id=document_id,
            book_id=book_id,
        )
        db.add(sync)
        db.commit()
        return sync


class ZapierService:
    """Zapier integration."""
    
    @staticmethod
    def log_action(db: Session, auth_id: str, action_type: str, action_data: dict, zap_id: str = None) -> ZapierAction:
        """Log Zapier action."""
        action = ZapierAction(
            id=str(uuid4()),
            auth_id=auth_id,
            action_type=action_type,
            action_data=action_data,
            zap_id=zap_id,
        )
        db.add(action)
        db.commit()
        return action
    
    @staticmethod
    def update_action_status(db: Session, action_id: str, status: str, result: dict = None, error: str = None):
        """Update action status."""
        action = db.query(ZapierAction).filter(ZapierAction.id == action_id).first()
        if action:
            action.status = status
            if result:
                action.result = result
            if error:
                action.error_message = error
            db.commit()


class ExportTemplateService:
    """Export template management."""
    
    @staticmethod
    def create_template(db: Session, user_id: str, name: str, format: str, **kwargs) -> ExportTemplate:
        """Create export template."""
        template = ExportTemplate(
            id=str(uuid4()),
            user_id=user_id,
            name=name,
            format=format,
            includes=kwargs.get("includes", []),
            filters=kwargs.get("filters", {}),
        )
        db.add(template)
        db.commit()
        return template
    
    @staticmethod
    def get_templates(db: Session, user_id: str) -> list:
        """Get user's export templates."""
        return db.query(ExportTemplate).filter(ExportTemplate.user_id == user_id).all()
