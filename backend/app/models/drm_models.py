"""
DRM Models - Database schema for content protection

Tracks encrypted files, issued licenses, access control, and piracy auditing.
"""

from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, JSON, Text, LargeBinary, Enum, ForeignKey
from sqlalchemy.orm import relationship
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
    
    id = Column(String(36), primary_key=True)  # UUID
    book_id = Column(String(36), ForeignKey("books.id"), nullable=False)
    file_name = Column(String(255), nullable=False)  # Original filename
    file_type = Column(String(20), nullable=False)  # pdf, epub, mobi, txt, zip
    
    # Encryption metadata
    encrypted_content = Column(LargeBinary, nullable=False)  # AES-256 encrypted file
    salt = Column(String(64), nullable=False)  # Encryption salt (hex)
    file_hash = Column(String(64), nullable=False)  # SHA256 of original file
    encrypted_hash = Column(String(64), nullable=False)  # SHA256 of encrypted file
    algorithm = Column(String(50), default="AES-256-CBC")
    key_derivation = Column(String(50), default="PBKDF2-SHA256-480k")
    
    # Access control
    access_level = Column(Enum(AccessLevelEnum), default=AccessLevelEnum.SUBSCRIBER)
    usage_rights = Column(JSON, default=[])  # List of UsageRightEnum values
    
    # Watermarking
    watermark_enabled = Column(Boolean, default=True)
    watermark_text_template = Column(String(255))  # e.g., "Licensed to {user_id}"
    
    # Offline access
    max_offline_downloads = Column(Integer, default=0)  # 0 = no offline
    offline_retention_days = Column(Integer, default=30)
    
    # Metadata
    original_size_bytes = Column(Integer)
    encrypted_size_bytes = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
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
    
    id = Column(String(36), primary_key=True)  # UUID (license_id)
    protected_file_id = Column(String(36), ForeignKey("protected_files.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    # Device binding
    device_id = Column(String(64), nullable=False)  # Hash of device fingerprint
    device_type = Column(String(20))  # web, ios, android, desktop
    
    # License validity
    issued_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)  # Expiration time
    is_active = Column(Boolean, default=True)
    
    # Content key (for decryption)
    content_key = Column(String(255), nullable=False)  # Encrypted key for content
    
    # Usage rights
    usage_rights = Column(JSON, default=[])  # List of allowed rights
    access_level = Column(Enum(AccessLevelEnum))
    
    # Offline access
    max_offline_downloads = Column(Integer, default=0)
    offline_downloads_used = Column(Integer, default=0)
    
    # Watermarking
    watermark_enabled = Column(Boolean, default=True)
    watermark_text = Column(String(255))  # Actual watermark content
    
    # License policy (JSON)
    policy = Column(JSON)  # Full license policy for verification
    signature = Column(String(64))  # HMAC signature of policy
    
    # Tracking
    last_accessed_at = Column(DateTime)
    access_count = Column(Integer, default=0)
    playback_seconds = Column(Integer, default=0)  # Total playback duration
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
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
    
    id = Column(String(36), primary_key=True)  # UUID
    protected_file_id = Column(String(36), ForeignKey("protected_files.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    # Revocation details
    license_id = Column(String(36), nullable=False)  # Original license being revoked
    revoked_at = Column(DateTime, default=datetime.utcnow)
    revocation_reason = Column(Text)  # e.g., "suspected_piracy", "account_suspended", "dmca_takedown"
    
    # Forensics
    piracy_evidence = Column(JSON)  # Evidence of piracy (device sharing, license sharing, etc.)
    investigation_notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    protected_file = relationship("ProtectedFile", back_populates="revocations")
    user = relationship("User", back_populates="drm_revocations")


class DRMPlaybackEvent(Base):
    """
    Playback audit trail for DRM content.
    
    Tracks access patterns to detect piracy and enforce usage rights.
    """
    __tablename__ = "drm_playback_events"
    
    id = Column(String(36), primary_key=True)  # UUID
    license_id = Column(String(36), ForeignKey("drm_licenses.id"), nullable=False)
    protected_file_id = Column(String(36), ForeignKey("protected_files.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    # Device info
    device_id = Column(String(64), nullable=False)
    device_type = Column(String(20))
    
    # Playback details
    playback_start_seconds = Column(Integer)  # Start position
    playback_end_seconds = Column(Integer)  # End position
    duration_seconds = Column(Integer)  # Playback duration
    
    # Network info
    ip_address = Column(String(45))  # IPv4 or IPv6
    country_code = Column(String(2))  # GeoIP location
    
    # Content info
    user_agent = Column(Text)
    
    # Timestamp
    event_timestamp = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
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
    
    id = Column(String(36), primary_key=True)  # UUID
    protected_file_id = Column(String(36), ForeignKey("protected_files.id"), nullable=False)
    license_id = Column(String(36), nullable=False)  # Original license
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    # Device binding
    device_id = Column(String(64), nullable=False)
    device_type = Column(String(20))
    
    # Bundle data
    encrypted_bundle = Column(LargeBinary, nullable=False)  # Zipped encrypted content + license
    bundle_hash = Column(String(64))  # SHA256 of bundle
    
    # Validity
    downloaded_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True)
    last_synced_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    protected_file = relationship("ProtectedFile", back_populates="offline_bundles")
    user = relationship("User", back_populates="offline_bundles")


class DRMWatermark(Base):
    """
    Watermark configuration and forensic tracking.
    
    Stores watermark patterns for piracy tracing.
    """
    __tablename__ = "drm_watermarks"
    
    id = Column(String(36), primary_key=True)  # UUID
    protected_file_id = Column(String(36), ForeignKey("protected_files.id"), nullable=False)
    
    # Watermark pattern
    watermark_pattern = Column(String(255), nullable=False)  # Pattern template
    enable_visible = Column(Boolean, default=True)  # User-visible watermark
    enable_forensic = Column(Boolean, default=True)  # Invisible forensic watermark
    
    # Distribution tracking
    watermarks_issued = Column(Integer, default=0)
    unique_watermarks = Column(Integer, default=0)
    
    # Piracy detection
    piracy_instances_detected = Column(Integer, default=0)
    detected_piracy_sources = Column(JSON, default=[])  # URLs/sources where pirated copy found
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DRMAnalytics(Base):
    """
    DRM analytics and reporting.
    
    Aggregated metrics for content protection monitoring.
    """
    __tablename__ = "drm_analytics"
    
    id = Column(String(36), primary_key=True)  # UUID
    protected_file_id = Column(String(36), ForeignKey("protected_files.id"), nullable=False)
    
    # Period
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    
    # License metrics
    total_licenses_issued = Column(Integer, default=0)
    active_licenses = Column(Integer, default=0)
    revoked_licenses = Column(Integer, default=0)
    expired_licenses = Column(Integer, default=0)
    
    # Access metrics
    total_views = Column(Integer, default=0)
    unique_users = Column(Integer, default=0)
    unique_devices = Column(Integer, default=0)
    total_playback_hours = Column(Integer, default=0)
    
    # Offline metrics
    offline_downloads = Column(Integer, default=0)
    offline_access_count = Column(Integer, default=0)
    
    # Piracy detection
    suspicious_access_patterns = Column(Integer, default=0)
    device_sharing_detected = Column(Integer, default=0)
    license_sharing_detected = Column(Integer, default=0)
    rapid_device_switching = Column(Integer, default=0)
    
    # Geographic
    access_by_country = Column(JSON, default={})
    
    # Watermark detection
    pirated_copies_found = Column(Integer, default=0)
    piracy_sources = Column(JSON, default=[])
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
