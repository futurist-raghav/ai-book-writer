"""
DRM Schemas - Request/response validation for DRM API
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class UsageRightEnum(str, Enum):
    VIEW = "view"
    PRINT = "print"
    COPY = "copy"
    OFFLINE = "offline"
    SHARE = "share"


class AccessLevelEnum(str, Enum):
    PUBLIC = "public"
    SUBSCRIBER = "subscriber"
    PREMIUM = "premium"
    RESTRICTED = "restricted"


# ==================== FILE PROTECTION ====================

class ProtectedFileCreate(BaseModel):
    """Request to protect/encrypt a file."""
    id: Optional[str] = None
    file_name: str
    file_type: str  # pdf, epub, mobi, txt, zip
    content: bytes
    access_level: AccessLevelEnum = AccessLevelEnum.SUBSCRIBER
    usage_rights: List[str] = Field(default=["view"], description="Allowed usage rights")
    watermark_enabled: bool = True
    max_offline_downloads: int = 0  # 0 = no offline access


class DRMFileResponse(BaseModel):
    """Response with protected file metadata."""
    id: str
    book_id: str
    file_name: str
    file_type: str
    access_level: str
    usage_rights: List[str]
    watermark_enabled: bool
    original_size: int
    encrypted_size: int
    created_at: datetime


# ==================== LICENSE GENERATION ====================

class DeviceInfo(BaseModel):
    """Device information for license binding."""
    device_type: str  # web, ios, android, desktop
    device_id: Optional[str] = None
    user_agent: str
    ip_address: str
    device_fingerprint: Optional[str] = None  # For additional binding


class DRMLicenseRequest(BaseModel):
    """Request to generate a content license."""
    file_id: str
    device_info: DeviceInfo
    usage_rights: List[UsageRightEnum] = Field(
        default=[UsageRightEnum.VIEW],
        description="Usage rights for this license"
    )
    expires_in_hours: Optional[int] = 24


class DRMLicenseResponse(BaseModel):
    """Response with issued license."""
    license_id: str
    file_id: str
    user_id: str
    issued_at: datetime
    expires_at: datetime
    content_key: str  # Key for decrypting content
    usage_rights: List[str]
    watermark_text: str  # Forensic watermark


# ==================== PLAYBACK TRACKING ====================

class PlaybackTrackingRequest(BaseModel):
    """Track content playback for audit trail."""
    license_id: str
    file_id: str
    device_id: str
    device_type: str = "web"
    playback_start: float  # Start position in seconds
    playback_end: float  # End position in seconds
    ip_address: Optional[str] = None
    country_code: Optional[str] = None


# ==================== OFFLINE ACCESS ====================

class OfflineDownloadRequest(BaseModel):
    """Request offline access to protected content."""
    license_id: str
    file_id: str
    device_id: str
    device_type: str = "mobile"


class OfflineAccessResponse(BaseModel):
    """Response to offline access request."""
    offline_bundle_id: str
    expires_at: datetime
    remaining_downloads: int
    sync_required_hours: int = 24  # Must sync online within this period


# ==================== ANALYTICS & MONITORING ====================

class DRMAnalyticsResponse(BaseModel):
    """DRM analytics report."""
    file_id: str
    period_days: int
    generated_at: datetime
    
    # License metrics
    total_licenses_issued: int
    active_licenses: int
    revoked_licenses: int
    
    # Access metrics
    total_playback_events: int
    unique_users: int
    unique_devices: int
    offline_downloads: int
    
    # Piracy indicators
    piracy_indicators: List[Dict[str, Any]]
    suspicious_device_patterns: Optional[List[str]] = None
    license_distribution: Dict[str, Any]


class DRMLicenseRevokeRequest(BaseModel):
    """Request to revoke a license."""
    reason: str  # e.g., "piracy_detected", "account_suspended", "user_request"
    evidence: Optional[Dict[str, Any]] = None


# ==================== LIST/OVERVIEW ====================

class DRMFileSummary(BaseModel):
    """Summary of protected files for a book."""
    id: str
    file_name: str
    file_type: str
    access_level: str
    usage_rights: List[str]
    total_licenses_issued: int
    active_licenses: int
    views_last_30_days: int
    created_at: datetime


class DRMLicenseSummary(BaseModel):
    """Summary of issued licenses."""
    license_id: str
    user_id: str
    file_name: str
    issued_at: datetime
    expires_at: datetime
    is_active: bool
    access_count: int
    last_accessed_at: Optional[datetime] = None
    usage_rights: List[str]
    watermark_text: str
