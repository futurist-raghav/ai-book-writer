"""API integrations models."""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, JSON, Text, Boolean, Enum
from sqlalchemy.orm import relationship
from app.db import Base
import enum


class IntegrationProvider(str, enum.Enum):
    """Integration provider types."""
    ZAPIER = "zapier"
    MAKE = "make"
    NOTION = "notion"
    GOOGLE_DOCS = "google_docs"
    SCRIVENER = "scrivener"
    SLACK = "slack"
    DISCORD = "discord"


class APIKey(Base):
    """API key for public API access."""
    
    __tablename__ = "api_keys"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Key info
    name = Column(String(255), nullable=False)
    key_hash = Column(String(255), nullable=False)  # bcrypt hash
    key_prefix = Column(String(8), nullable=False)  # First 8 chars visible
    
    # Permissions
    scopes = Column(JSON, default=[])  # ["read", "write", "admin"]
    
    # Usage tracking
    status = Column(String(50), default="active")  # active, revoked, expired
    last_used_at = Column(DateTime, nullable=True)
    use_count = Column(Integer, default=0)
    
    # Dates
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)  # Optional expiry
    revoked_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class Webhook(Base):
    """Webhook subscription for events."""
    
    __tablename__ = "webhooks"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Target
    url = Column(String(500), nullable=False)
    
    # Events
    events = Column(JSON, default=[])  # [manuscript.published, chapter.completed, ...]
    
    # Custom headers
    headers = Column(JSON, default={})
    
    # Status
    is_active = Column(Integer, default=1)
    
    # Retry tracking
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=5)
    
    # Usage
    delivery_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    last_delivery_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class WebhookDelivery(Base):
    """Individual webhook delivery record."""
    
    __tablename__ = "webhook_deliveries"
    
    id = Column(String(36), primary_key=True, index=True)
    webhook_id = Column(String(36), ForeignKey("webhooks.id"), nullable=False, index=True)
    
    # Event
    event = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=False)
    
    # Request
    request_headers = Column(JSON, default={})
    
    # Response
    status_code = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    
    # Retry info
    attempt_number = Column(Integer, default=1)
    next_retry_at = Column(DateTime, nullable=True)
    
    delivered_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    webhook = relationship("Webhook", foreign_keys=[webhook_id])


class IntegrationAuth(Base):
    """Third-party integration authorization."""
    
    __tablename__ = "integration_auths"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # OAuth tokens
    provider = Column(String(50), nullable=False)  # zapier, notion, google_docs, slack, discord
    oauth_access_token = Column(Text, nullable=True)
    oauth_refresh_token = Column(Text, nullable=True)
    oauth_expires_at = Column(DateTime, nullable=True)
    
    # Provider-specific data
    provider_user_id = Column(String(255), nullable=True)
    provider_workspace_id = Column(String(255), nullable=True)
    
    # Sync settings
    sync_enabled = Column(Integer, default=1)
    sync_interval_minutes = Column(Integer, default=60)
    last_sync_at = Column(DateTime, nullable=True)
    
    # Status
    is_active = Column(Integer, default=1)
    
    # Error tracking
    last_error = Column(Text, nullable=True)
    error_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class NotionSync(Base):
    """Notion database sync configuration."""
    
    __tablename__ = "notion_syncs"
    
    id = Column(String(36), primary_key=True, index=True)
    auth_id = Column(String(36), ForeignKey("integration_auths.id"), nullable=False, unique=True)
    
    # Database
    notion_database_id = Column(String(255), nullable=False)
    notion_database_name = Column(String(255), nullable=True)
    
    # Sync mapping
    mapping = Column(JSON, default={})  # {book_field: notion_property}
    
    # Sync direction
    direction = Column(String(50), default="two-way")  # one-way, two-way
    
    # Last sync
    last_sync_at = Column(DateTime, nullable=True)
    synced_records_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    auth = relationship("IntegrationAuth", foreign_keys=[auth_id])


class GoogleDocsSync(Base):
    """Google Docs document sync."""
    
    __tablename__ = "google_docs_syncs"
    
    id = Column(String(36), primary_key=True, index=True)
    auth_id = Column(String(36), ForeignKey("integration_auths.id"), nullable=False)
    
    # Document
    document_id = Column(String(255), nullable=False)
    document_name = Column(String(255), nullable=True)
    
    # Mapping
    book_id = Column(String(36), ForeignKey("books.id"), nullable=False)
    chapter_id = Column(String(36), ForeignKey("chapters.id"), nullable=True)
    
    # Sync settings
    last_sync_at = Column(DateTime, nullable=True)
    last_edit_time = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    auth = relationship("IntegrationAuth", foreign_keys=[auth_id])
    book = relationship("Book", foreign_keys=[book_id])
    chapter = relationship("Chapter", foreign_keys=[chapter_id])


class ZapierAction(Base):
    """Zapier action log."""
    
    __tablename__ = "zapier_actions"
    
    id = Column(String(36), primary_key=True, index=True)
    auth_id = Column(String(36), ForeignKey("integration_auths.id"), nullable=False)
    
    # Action
    action_type = Column(String(100), nullable=False)  # create_chapter, add_comment, etc
    action_data = Column(JSON, nullable=False)
    
    # Result
    status = Column(String(50), default="pending")  # pending, success, failed
    result = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Zapier
    zap_id = Column(String(255), nullable=True)
    
    executed_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    auth = relationship("IntegrationAuth", foreign_keys=[auth_id])


class ExportTemplate(Base):
    """Export template for programmatic data export."""
    
    __tablename__ = "export_templates"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Template
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Export config
    format = Column(String(50))  # json, csv, xml, markdown
    includes = Column(JSON, default=[])  # [chapters, events, characters, etc]
    filters = Column(JSON, default={})  # {status: draft, tags: [...]}
    
    # Webhook trigger
    webhook_trigger_enabled = Column(Integer, default=0)
    trigger_events = Column(JSON, default=[])
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
