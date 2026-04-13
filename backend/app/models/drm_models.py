"""
DRM Models - Database schema for content protection

Tracks encrypted files, issued licenses, access control, and piracy auditing.
"""

from typing import TYPE_CHECKING, Optional

from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, JSON, Text, LargeBinary, Enum, ForeignKey, Float, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db import Base


class UsageRightEnum(str, enum.Enum):
    """Usage rights enumeration."""
    VIEW = "view"
    PRINT = "print"
    COPY = "copy"
    OFFLINE = "offline"
    SHARE = "share"


class AccessLevelEnum(str, enum.Enum):
    """Access level enumeration."""
    PUBLIC = "public"
    SUBSCRIBER = "subscriber"
    PREMIUM = "premium"
    RESTRICTED = "restricted"


class ProtectedFile(Base):
    """
    Encrypted file storage for DRM protection.
    
    Stores encrypted content with metadata needed for decryption and access control.
    """
    __tablename__ = "protected_files"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True) # UUID
    book_id: Mapped[str] = mapped_column(String(36), ForeignKey("books.id"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False) # Original filename
    file_type: Mapped[str] = mapped_column(String(20), nullable=False) # pdf, epub, mobi, txt, zip
    
    # Encryption metadata
    encrypted_content = Column(LargeBinary, nullable=False)  # AES-256 encrypted file
    salt: Mapped[str] = mapped_column(String(64), nullable=False)  # Encryption salt (hex)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False) # SHA256 of original file
    encrypted_hash: Mapped[str] = mapped_column(String(64), nullable=False) # SHA256 of encrypted file
    algorithm: Mapped[str] = mapped_column(String(50), default="AES-256-CBC")
    key_derivation: Mapped[str] = mapped_column(String(50), default="PBKDF2-SHA256-480k")
    
    # Access control
    access_level = Column(Enum(AccessLevelEnum), default=AccessLevelEnum.SUBSCRIBER)
    usage_rights: Mapped[dict] = mapped_column(JSON, default=[]) # List of UsageRightEnum values
    
    # Watermarking
    watermark_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    watermark_text_template: Mapped[str] = mapped_column(String(255)) # e.g., "Licensed to {user_id}"
    
    # Offline access
    max_offline_downloads: Mapped[int] = mapped_column(Integer, default=0) # 0 = no offline
    offline_retention_days: Mapped[int] = mapped_column(Integer, default=30)
    
    # Metadata
    original_size_bytes: Mapped[int] = mapped_column(Integer)
    encrypted_size_bytes: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    book = relationship("Book", back_populates="drm_files")
    licenses = relationship("DRMLicense", back_populates="protected_file", cascade="all, delete-orphan")
    revocations = relationship("DRMRevocation", back_populates="protected_file", cascade="all, delete-orphan")
    playback_events = relationship("DRMPlaybackEvent", back_populates="protected_file", cascade="all, delete-orphan")
    offline_bundles = relationship("OfflineBundle", back_populates="protected_file", cascade="all, delete-orphan")


class DRMLicense(Base):
    """
    Content license - permits access to encrypted content.
    
    Binds usage rights, device, expiration, and watermark info.
    """
    __tablename__ = "drm_licenses"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # UUID (license_id)
    protected_file_id: Mapped[str] = mapped_column(String(36), ForeignKey("protected_files.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    
    # Device binding
    device_id: Mapped[str] = mapped_column(String(64), nullable=False) # Hash of device fingerprint
    device_type: Mapped[str] = mapped_column(String(20)) # web, ios, android, desktop
    
    # License validity
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False) # Expiration time
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Content key (for decryption)
    content_key: Mapped[str] = mapped_column(String(255), nullable=False) # Encrypted key for content
    
    # Usage rights
    usage_rights: Mapped[dict] = mapped_column(JSON, default=[]) # List of allowed rights
    access_level = Column(Enum(AccessLevelEnum))
    
    # Offline access
    max_offline_downloads: Mapped[int] = mapped_column(Integer, default=0)
    offline_downloads_used: Mapped[int] = mapped_column(Integer, default=0)
    
    # Watermarking
    watermark_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    watermark_text: Mapped[str] = mapped_column(String(255)) # Actual watermark content
    
    # License policy (JSON)
    policy: Mapped[dict] = mapped_column(JSON) # Full license policy for verification
    signature: Mapped[str] = mapped_column(String(64)) # HMAC signature of policy
    
    # Tracking
    last_accessed_at: Mapped[datetime] = mapped_column(DateTime)
    access_count: Mapped[int] = mapped_column(Integer, default=0)
    playback_seconds: Mapped[int] = mapped_column(Integer, default=0) # Total playback duration
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    protected_file = relationship("ProtectedFile", back_populates="licenses")
    user = relationship("User", back_populates="drm_licenses")
    playback_events = relationship("DRMPlaybackEvent", back_populates="license", cascade="all, delete-orphan")


class DRMRevocation(Base):
    """
    Revoked licenses - invalidates previously issued keys.
    
    Used for abuse/piracy detection or account suspension.
    """
    __tablename__ = "drm_revocations"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True) # UUID
    protected_file_id: Mapped[str] = mapped_column(String(36), ForeignKey("protected_files.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    
    # Revocation details
    license_id: Mapped[str] = mapped_column(String(36), nullable=False) # Original license being revoked
    revoked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    revocation_reason: Mapped[str] = mapped_column(Text) # e.g., "suspected_piracy", "account_suspended", "dmca_takedown"
    
    # Forensics
    piracy_evidence: Mapped[dict] = mapped_column(JSON)  # Evidence of piracy (device sharing, license sharing, etc.)
    investigation_notes: Mapped[str] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    protected_file = relationship("ProtectedFile", back_populates="revocations")
    user = relationship("User", back_populates="drm_revocations")


class DRMPlaybackEvent(Base):
    """
    Playback audit trail for DRM content.
    
    Tracks access patterns to detect piracy and enforce usage rights.
    """
    __tablename__ = "drm_playback_events"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True) # UUID
    license_id: Mapped[str] = mapped_column(String(36), ForeignKey("drm_licenses.id"), nullable=False)
    protected_file_id: Mapped[str] = mapped_column(String(36), ForeignKey("protected_files.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    
    # Device info
    device_id: Mapped[str] = mapped_column(String(64), nullable=False)
    device_type: Mapped[str] = mapped_column(String(20))
    
    # Playback details
    playback_start_seconds: Mapped[int] = mapped_column(Integer) # Start position
    playback_end_seconds: Mapped[int] = mapped_column(Integer) # End position
    duration_seconds: Mapped[int] = mapped_column(Integer) # Playback duration
    
    # Network info
    ip_address: Mapped[str] = mapped_column(String(45)) # IPv4 or IPv6
    country_code: Mapped[str] = mapped_column(String(2)) # GeoIP location
    
    # Content info
    user_agent: Mapped[str] = mapped_column(Text)
    
    # Timestamp
    event_timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    license = relationship("DRMLicense", back_populates="playback_events")
    protected_file = relationship("ProtectedFile", back_populates="playback_events")
    user = relationship("User", back_populates="drm_playback_events")


class OfflineBundle(Base):
    """
    Offline content bundle - encrypted content for offline access.
    
    Time-limited and device-locked offline copies.
    """
    __tablename__ = "offline_bundles"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True) # UUID
    protected_file_id: Mapped[str] = mapped_column(String(36), ForeignKey("protected_files.id"), nullable=False)
    license_id: Mapped[str] = mapped_column(String(36), nullable=False) # Original license
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    
    # Device binding
    device_id: Mapped[str] = mapped_column(String(64), nullable=False)
    device_type: Mapped[str] = mapped_column(String(20))
    
    # Bundle data
    encrypted_bundle = Column(LargeBinary, nullable=False)  # Zipped encrypted content + license
    bundle_hash: Mapped[str] = mapped_column(String(64)) # SHA256 of bundle
    
    # Validity
    downloaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_synced_at: Mapped[datetime] = mapped_column(DateTime)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    protected_file = relationship("ProtectedFile", back_populates="offline_bundles")
    user = relationship("User", back_populates="offline_bundles")


class DRMWatermark(Base):
    """
    Watermark configuration and forensic tracking.
    
    Stores watermark patterns for piracy tracing.
    """
    __tablename__ = "drm_watermarks"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True) # UUID
    protected_file_id: Mapped[str] = mapped_column(String(36), ForeignKey("protected_files.id"), nullable=False)
    
    # Watermark pattern
    watermark_pattern: Mapped[str] = mapped_column(String(255), nullable=False) # Pattern template
    enable_visible: Mapped[bool] = mapped_column(Boolean, default=True) # User-visible watermark
    enable_forensic: Mapped[bool] = mapped_column(Boolean, default=True) # Invisible forensic watermark
    
    # Distribution tracking
    watermarks_issued: Mapped[int] = mapped_column(Integer, default=0)
    unique_watermarks: Mapped[int] = mapped_column(Integer, default=0)
    
    # Piracy detection
    piracy_instances_detected: Mapped[int] = mapped_column(Integer, default=0)
    detected_piracy_sources: Mapped[dict] = mapped_column(JSON, default=[]) # URLs/sources where pirated copy found
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DRMAnalytics(Base):
    """
    DRM analytics and reporting.
    
    Aggregated metrics for content protection monitoring.
    """
    __tablename__ = "drm_analytics"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True) # UUID
    protected_file_id: Mapped[str] = mapped_column(String(36), ForeignKey("protected_files.id"), nullable=False)
    
    # Period
    period_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    
    # License metrics
    total_licenses_issued: Mapped[int] = mapped_column(Integer, default=0)
    active_licenses: Mapped[int] = mapped_column(Integer, default=0)
    revoked_licenses: Mapped[int] = mapped_column(Integer, default=0)
    expired_licenses: Mapped[int] = mapped_column(Integer, default=0)
    
    # Access metrics
    total_views: Mapped[int] = mapped_column(Integer, default=0)
    unique_users: Mapped[int] = mapped_column(Integer, default=0)
    unique_devices: Mapped[int] = mapped_column(Integer, default=0)
    total_playback_hours: Mapped[int] = mapped_column(Integer, default=0)
    
    # Offline metrics
    offline_downloads: Mapped[int] = mapped_column(Integer, default=0)
    offline_access_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Piracy detection
    suspicious_access_patterns: Mapped[int] = mapped_column(Integer, default=0)
    device_sharing_detected: Mapped[int] = mapped_column(Integer, default=0)
    license_sharing_detected: Mapped[int] = mapped_column(Integer, default=0)
    rapid_device_switching: Mapped[int] = mapped_column(Integer, default=0)
    
    # Geographic
    access_by_country: Mapped[dict] = mapped_column(JSON, default={})
    
    # Watermark detection
    pirated_copies_found: Mapped[int] = mapped_column(Integer, default=0)
    piracy_sources: Mapped[dict] = mapped_column(JSON, default=[])
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
