"""API integrations models."""

from typing import TYPE_CHECKING, Optional

from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Integer, JSON, Text, Boolean, Enum, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
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
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Key info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(255), nullable=False) # bcrypt hash
    key_prefix: Mapped[str] = mapped_column(String(8), nullable=False) # First 8 chars visible
    
    # Permissions
    scopes: Mapped[dict] = mapped_column(JSON, default=[]) # ["read", "write", "admin"]
    
    # Usage tracking
    status: Mapped[str] = mapped_column(String(50), default="active") # active, revoked, expired
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    use_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Dates
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True) # Optional expiry
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class Webhook(Base):
    """Webhook subscription for events."""
    
    __tablename__ = "webhooks"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Target
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    
    # Events
    events: Mapped[dict] = mapped_column(JSON, default=[]) # [manuscript.published, chapter.completed, ...]
    
    # Custom headers
    headers: Mapped[dict] = mapped_column(JSON, default={})
    
    # Status
    is_active: Mapped[int] = mapped_column(Integer, default=1)
    
    # Retry tracking
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=5)
    
    # Usage
    delivery_count: Mapped[int] = mapped_column(Integer, default=0)
    failure_count: Mapped[int] = mapped_column(Integer, default=0)
    last_delivery_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class WebhookDelivery(Base):
    """Individual webhook delivery record."""
    
    __tablename__ = "webhook_deliveries"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    webhook_id: Mapped[str] = mapped_column(String(36), ForeignKey("webhooks.id"), nullable=False, index=True)
    
    # Event
    event: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    
    # Request
    request_headers: Mapped[dict] = mapped_column(JSON, default={})
    
    # Response
    status_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    response_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    response_time_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Retry info
    attempt_number: Mapped[int] = mapped_column(Integer, default=1)
    next_retry_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    delivered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    webhook = relationship("Webhook", foreign_keys=[webhook_id])


class IntegrationAuth(Base):
    """Third-party integration authorization."""
    
    __tablename__ = "integration_auths"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # OAuth tokens
    provider: Mapped[str] = mapped_column(String(50), nullable=False) # zapier, notion, google_docs, slack, discord
    oauth_access_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    oauth_refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    oauth_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Provider-specific data
    provider_user_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    provider_workspace_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Sync settings
    sync_enabled: Mapped[int] = mapped_column(Integer, default=1)
    sync_interval_minutes: Mapped[int] = mapped_column(Integer, default=60)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Status
    is_active: Mapped[int] = mapped_column(Integer, default=1)
    
    # Error tracking
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])


class NotionSync(Base):
    """Notion database sync configuration."""
    
    __tablename__ = "notion_syncs"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    auth_id: Mapped[str] = mapped_column(String(36), ForeignKey("integration_auths.id"), nullable=False, unique=True)
    
    # Database
    notion_database_id: Mapped[str] = mapped_column(String(255), nullable=False)
    notion_database_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Sync mapping
    mapping: Mapped[dict] = mapped_column(JSON, default={}) # {book_field: notion_property}
    
    # Sync direction
    direction: Mapped[str] = mapped_column(String(50), default="two-way") # one-way, two-way
    
    # Last sync
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    synced_records_count: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    auth = relationship("IntegrationAuth", foreign_keys=[auth_id])


class GoogleDocsSync(Base):
    """Google Docs document sync."""
    
    __tablename__ = "google_docs_syncs"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    auth_id: Mapped[str] = mapped_column(String(36), ForeignKey("integration_auths.id"), nullable=False)
    
    # Document
    document_id: Mapped[str] = mapped_column(String(255), nullable=False)
    document_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Mapping
    book_id: Mapped[str] = mapped_column(String(36), ForeignKey("books.id"), nullable=False)
    chapter_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("chapters.id"), nullable=True)
    
    # Sync settings
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_edit_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    auth = relationship("IntegrationAuth", foreign_keys=[auth_id])
    book = relationship("Book", foreign_keys=[book_id])
    chapter = relationship("Chapter", foreign_keys=[chapter_id])


class ZapierAction(Base):
    """Zapier action log."""
    
    __tablename__ = "zapier_actions"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    auth_id: Mapped[str] = mapped_column(String(36), ForeignKey("integration_auths.id"), nullable=False)
    
    # Action
    action_type: Mapped[str] = mapped_column(String(100), nullable=False) # create_chapter, add_comment, etc
    action_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    
    # Result
    status: Mapped[str] = mapped_column(String(50), default="pending") # pending, success, failed
    result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Zapier
    zap_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    executed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    auth = relationship("IntegrationAuth", foreign_keys=[auth_id])


class ExportTemplate(Base):
    """Export template for programmatic data export."""
    
    __tablename__ = "export_templates"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Template
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Export config
    format: Mapped[str] = mapped_column(String(50)) # json, csv, xml, markdown
    includes: Mapped[dict] = mapped_column(JSON, default=[]) # [chapters, events, characters, etc]
    filters: Mapped[dict] = mapped_column(JSON, default={}) # {status: draft, tags: [...]}
    
    # Webhook trigger
    webhook_trigger_enabled: Mapped[int] = mapped_column(Integer, default=0)
    trigger_events: Mapped[dict] = mapped_column(JSON, default=[])
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
