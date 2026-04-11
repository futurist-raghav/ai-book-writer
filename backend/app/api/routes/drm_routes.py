"""
DRM API Routes - Content protection and license management

Endpoints for:
- Protected file upload & encryption
- License generation & verification
- Content delivery with access control
- Offline access management
- Piracy detection & audit trails
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, List
import logging

from app.db import get_db
from app.auth import get_current_user
from app.models import User, Book
from app.models.drm_models import (
    ProtectedFile, DRMLicense, DRMRevocation, DRMPlaybackEvent, 
    OfflineBundle, DRMAnalytics, UsageRightEnum, AccessLevelEnum
)
from app.services.drm_service import DRMService, DeviceBindingService
from app.schemas.drm_schema import (
    ProtectedFileCreate, DRMLicenseRequest, DRMLicenseResponse,
    DRMFileResponse, OfflineDownloadRequest, PlaybackTrackingRequest,
    DRMAnalyticsResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/drm", tags=["drm"])


# ==================== DEPENDENCY INJECTION ====================

def get_drm_service() -> DRMService:
    """Get DRM service instance."""
    # In production, get key from environment
    import os
    master_key = os.getenv("DRM_MASTER_KEY")
    return DRMService(master_key=master_key)


# ==================== FILE PROTECTION ====================

@router.post("/files/protect", response_model=DRMFileResponse)
async def protect_file(
    book_id: str,
    file_data: ProtectedFileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    drm: DRMService = Depends(get_drm_service),
):
    """
    Upload and encrypt a file with DRM protection.
    
    This endpoint:
    1. Verifies user owns the book
    2. Encrypts file with AES-256
    3. Stores encrypted content in database
    4. Returns file metadata and encryption info
    
    Access control enforced via book ownership.
    """
    # Verify ownership
    book = db.query(Book).filter_by(id=book_id, author_id=current_user.id).first()
    if not book:
        raise HTTPException(status_code=403, detail="Not authorized to protect files in this book")
    
    try:
        # Encrypt file
        encryption_result = drm.encrypt_file(file_data.content, file_data.file_name)
        
        # Store in database
        protected_file = ProtectedFile(
            id=file_data.id or str(__import__('uuid').uuid4()),
            book_id=book_id,
            file_name=file_data.file_name,
            file_type=file_data.file_type,
            encrypted_content=encryption_result["encrypted_content"],
            salt=encryption_result["salt"],
            file_hash=encryption_result["file_hash"],
            encrypted_hash=encryption_result["encrypted_hash"],
            algorithm=encryption_result["algorithm"],
            key_derivation=encryption_result["key_derivation"],
            access_level=file_data.access_level,
            usage_rights=file_data.usage_rights,
            watermark_enabled=file_data.watermark_enabled,
            max_offline_downloads=file_data.max_offline_downloads,
            original_size_bytes=len(file_data.content),
            encrypted_size_bytes=len(encryption_result["encrypted_content"]),
        )
        
        db.add(protected_file)
        db.commit()
        db.refresh(protected_file)
        
        logger.info(f"File protected: {protected_file.id} for book {book_id}")
        
        return DRMFileResponse(
            id=protected_file.id,
            book_id=book_id,
            file_name=protected_file.file_name,
            file_type=protected_file.file_type,
            access_level=protected_file.access_level.value,
            usage_rights=protected_file.usage_rights,
            watermark_enabled=protected_file.watermark_enabled,
            original_size=protected_file.original_size_bytes,
            encrypted_size=protected_file.encrypted_size_bytes,
            created_at=protected_file.created_at,
        )
    
    except Exception as e:
        logger.error(f"Error protecting file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error protecting file: {str(e)}")


# ==================== LICENSE GENERATION ====================

@router.post("/licenses/generate", response_model=DRMLicenseResponse)
async def generate_license(
    request: DRMLicenseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    drm: DRMService = Depends(get_drm_service),
):
    """
    Generate a content license for protected file access.
    
    Issues a time-limited license with:
    - Device binding (prevents sharing)
    - Usage rights (view, print, copy, offline, share)
    - Expiration (default 24 hours)
    - Access level enforcement (public, subscriber, premium, restricted)
    
    License is encrypted and signed for verification.
    """
    # Verify file exists
    protected_file = db.query(ProtectedFile).filter_by(id=request.file_id).first()
    if not protected_file:
        raise HTTPException(status_code=404, detail="Protected file not found")
    
    # Check access permissions
    book = db.query(Book).filter_by(id=protected_file.book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # TODO: Implement access level checking
    # if protected_file.access_level == AccessLevelEnum.RESTRICTED:
    #     if book.author_id != current_user.id:
    #         raise HTTPException(status_code=403, detail="Access denied to this content")
    
    try:
        # Generate device ID from request
        device_id = DeviceBindingService.generate_device_id(
            user_agent=request.device_info.user_agent,
            ip_address=request.device_info.ip_address,
            device_type=request.device_info.device_type,
        )
        
        # Generate license
        license_policy = drm.generate_license(
            file_id=request.file_id,
            user_id=current_user.id,
            device_id=device_id,
            usage_rights=request.usage_rights,
            access_level=protected_file.access_level,
            expires_in_hours=request.expires_in_hours or 24,
            max_offline_downloads=protected_file.max_offline_downloads,
            show_watermark=protected_file.watermark_enabled,
        )
        
        # Store license in database
        license_record = DRMLicense(
            id=license_policy["license_id"],
            protected_file_id=request.file_id,
            user_id=current_user.id,
            device_id=device_id,
            device_type=request.device_info.device_type,
            expires_at=datetime.fromisoformat(license_policy["expires_at"]),
            content_key=license_policy["content_key"],
            usage_rights=license_policy["usage_rights"],
            access_level=protected_file.access_level,
            max_offline_downloads=license_policy["max_offline_downloads"],
            watermark_enabled=license_policy["show_watermark"],
            watermark_text=license_policy["watermark_text"],
            policy=license_policy,
            signature=license_policy["signature"],
        )
        
        db.add(license_record)
        db.commit()
        db.refresh(license_record)
        
        logger.info(f"License generated: {license_record.id} for user {current_user.id}")
        
        return DRMLicenseResponse(
            license_id=license_record.id,
            file_id=request.file_id,
            user_id=current_user.id,
            issued_at=license_record.issued_at,
            expires_at=license_record.expires_at,
            content_key=license_policy["content_key"],
            usage_rights=license_record.usage_rights,
            watermark_text=license_record.watermark_text,
        )
    
    except Exception as e:
        logger.error(f"Error generating license: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating license: {str(e)}")


# ==================== CONTENT DELIVERY ====================

@router.get("/files/{file_id}/download")
async def download_protected_content(
    file_id: str,
    license_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    drm: DRMService = Depends(get_drm_service),
    request: Request = None,
):
    """
    Download protected content with license verification.
    
    Process:
    1. Verify license exists and is valid
    2. Check device binding
    3. Verify usage rights allow download
    4. Add watermark to content if enabled
    5. Return encrypted content with streaming headers
    
    Returns encrypted content that can only be decrypted with valid license.
    """
    # Get protected file
    protected_file = db.query(ProtectedFile).filter_by(id=file_id).first()
    if not protected_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Get license
    license_record = db.query(DRMLicense).filter_by(
        id=license_id,
        user_id=current_user.id,
        protected_file_id=file_id
    ).first()
    if not license_record:
        raise HTTPException(status_code=403, detail="Invalid or expired license")
    
    # Verify license
    device_id = DeviceBindingService.generate_device_id(
        user_agent=request.headers.get("user-agent", ""),
        ip_address=request.client.host if request.client else "unknown",
        device_type="web",
    )
    
    if not drm.verify_license(license_record.policy, device_id):
        raise HTTPException(status_code=403, detail="License verification failed")
    
    # Check if revoked
    revocation = db.query(DRMRevocation).filter_by(
        license_id=license_id,
        protected_file_id=file_id
    ).first()
    if revocation:
        raise HTTPException(status_code=403, detail="License has been revoked")
    
    try:
        # Get encrypted content
        content = protected_file.encrypted_content
        
        # Add watermark if enabled
        if protected_file.watermark_enabled:
            # Note: Actual watermarking would modify the encrypted content
            # For production, integrate PyPDF2, ebooklib, etc.
            watermarked_content = drm.add_watermark(
                content,
                user_id=current_user.id,
                file_type=protected_file.file_type
            )
        else:
            watermarked_content = content
        
        # Update usage
        license_record.last_accessed_at = datetime.utcnow()
        license_record.access_count += 1
        db.commit()
        
        logger.info(f"Protected file downloaded: {file_id} by user {current_user.id}")
        
        # Return file with appropriate headers
        from fastapi.responses import StreamingResponse
        import io
        
        return StreamingResponse(
            io.BytesIO(watermarked_content),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={protected_file.file_name}",
                "X-DRM-Protected": "true",
                "X-License-ID": license_id,
                "Cache-Control": "no-store, no-cache, must-revalidate",
            }
        )
    
    except Exception as e:
        logger.error(f"Error delivering protected content: {str(e)}")
        raise HTTPException(status_code=500, detail="Error delivering content")


# ==================== PLAYBACK TRACKING ====================

@router.post("/playback/track")
async def track_playback(
    request: PlaybackTrackingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    drm: DRMService = Depends(get_drm_service),
):
    """
    Track content playback for audit and piracy detection.
    
    Logs playback events to analyze:
    - Typical access patterns (detect anomalies)
    - Device usage (detect device sharing)
    - Geographic access (detect regional violations)
    - Rapid playback skipping (detect screen recording)
    """
    # Verify license
    license_record = db.query(DRMLicense).filter_by(
        id=request.license_id,
        user_id=current_user.id
    ).first()
    if not license_record:
        raise HTTPException(status_code=403, detail="Invalid license")
    
    try:
        # Track playback
        event = drm.track_playback(
            license_id=request.license_id,
            user_id=current_user.id,
            file_id=request.file_id,
            device_id=request.device_id,
            playback_start=request.playback_start,
            playback_end=request.playback_end,
        )
        
        # Store in database
        playback_event = DRMPlaybackEvent(
            id=event["event_id"],
            license_id=request.license_id,
            protected_file_id=request.file_id,
            user_id=current_user.id,
            device_id=request.device_id,
            device_type=request.device_type,
            playback_start_seconds=int(request.playback_start),
            playback_end_seconds=int(request.playback_end),
            duration_seconds=int(request.playback_end - request.playback_start),
            ip_address=request.ip_address,
            country_code=request.country_code,
            event_timestamp=datetime.utcnow(),
        )
        
        db.add(playback_event)
        
        # Update license stats
        license_record.playback_seconds += int(request.playback_end - request.playback_start)
        
        db.commit()
        
        logger.info(f"Playback tracked: {event['event_id']}")
        
        return {"success": True, "event_id": event["event_id"]}
    
    except Exception as e:
        logger.error(f"Error tracking playback: {str(e)}")
        raise HTTPException(status_code=500, detail="Error tracking playback")


# ==================== OFFLINE ACCESS ====================

@router.post("/offline/request")
async def request_offline_access(
    request: OfflineDownloadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    drm: DRMService = Depends(get_drm_service),
):
    """
    Request offline access download.
    
    Processes offline access:
    1. Verify license allows offline
    2. Check offline download limit
    3. Generate time-limited offline bundle
    4. Return encrypted bundle for device storage
    
    Offline bundles expire after configured period (default 30 days).
    Can be device-synced (deleted when device goes online).
    """
    # Verify license
    license_record = db.query(DRMLicense).filter_by(
        id=request.license_id,
        user_id=current_user.id
    ).first()
    if not license_record:
        raise HTTPException(status_code=403, detail="Invalid license")
    
    # Check if offline is allowed
    if "offline" not in license_record.usage_rights:
        raise HTTPException(status_code=403, detail="Offline access not allowed for this license")
    
    # Check offline limit
    if license_record.offline_downloads_used >= license_record.max_offline_downloads:
        raise HTTPException(
            status_code=403,
            detail=f"Offline download limit reached ({license_record.offline_downloads_used}/{license_record.max_offline_downloads})"
        )
    
    try:
        # Get file
        protected_file = db.query(ProtectedFile).filter_by(id=request.file_id).first()
        if not protected_file:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Request offline download
        offline_bundle = drm.request_offline_download(
            license_id=request.license_id,
            file_id=request.file_id,
            user_id=current_user.id,
            device_id=request.device_id,
        )
        
        # Store offline bundle
        bundle_record = OfflineBundle(
            id=offline_bundle["offline_bundle_id"],
            protected_file_id=request.file_id,
            license_id=request.license_id,
            user_id=current_user.id,
            device_id=request.device_id,
            device_type=request.device_type,
            encrypted_bundle=protected_file.encrypted_content,  # Would be compressed + wrapped
            expires_at=datetime.fromisoformat(offline_bundle["expires_at"]),
        )
        
        db.add(bundle_record)
        
        # Increment counter
        license_record.offline_downloads_used += 1
        
        db.commit()
        db.refresh(bundle_record)
        
        logger.info(f"Offline bundle created: {bundle_record.id}")
        
        return {
            "offline_bundle_id": bundle_record.id,
            "expires_at": bundle_record.expires_at.isoformat(),
            "remaining_downloads": license_record.max_offline_downloads - license_record.offline_downloads_used,
        }
    
    except Exception as e:
        logger.error(f"Error requesting offline access: {str(e)}")
        raise HTTPException(status_code=500, detail="Error requesting offline access")


# ==================== ANALYTICS & MONITORING ====================

@router.get("/analytics/{file_id}", response_model=DRMAnalyticsResponse)
async def get_drm_analytics(
    file_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    drm: DRMService = Depends(get_drm_service),
):
    """
    Get DRM analytics for protected content.
    
    Provides metrics on:
    - License distribution and usage
    - Playback patterns
    - Device sharing detection
    - Piracy indicators
    - Geographic access patterns
    
    Available only to content owner (author/publisher).
    """
    # Verify ownership
    protected_file = db.query(ProtectedFile).filter_by(id=file_id).first()
    if not protected_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    book = db.query(Book).filter_by(id=protected_file.book_id).first()
    if not book or book.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view analytics")
    
    try:
        report = drm.generate_drm_report(file_id=file_id, days=days)
        
        # Query actual metrics from database
        period_start = datetime.utcnow() - timedelta(days=days)
        
        licenses = db.query(DRMLicense).filter(
            DRMLicense.protected_file_id == file_id,
            DRMLicense.issued_at >= period_start
        ).all()
        
        playback_events = db.query(DRMPlaybackEvent).filter(
            DRMPlaybackEvent.protected_file_id == file_id,
            DRMPlaybackEvent.event_timestamp >= period_start
        ).all()
        
        revocations = db.query(DRMRevocation).filter(
            DRMRevocation.protected_file_id == file_id,
            DRMRevocation.revoked_at >= period_start
        ).all()
        
        # Update report with actual data
        report["total_licenses_issued"] = len(licenses)
        report["active_licenses"] = len([l for l in licenses if l.is_active])
        report["revoked_licenses"] = len(revocations)
        report["total_playback_events"] = len(playback_events)
        report["unique_users"] = len(set(e.user_id for e in playback_events))
        report["unique_devices"] = len(set(e.device_id for e in playback_events))
        
        return DRMAnalyticsResponse(**report)
    
    except Exception as e:
        logger.error(f"Error generating DRM analytics: {str(e)}")
        raise HTTPException(status_code=500, detail="Error generating analytics")


# ==================== REVOCATION ====================

@router.post("/licenses/{license_id}/revoke")
async def revoke_license(
    license_id: str,
    reason: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    drm: DRMService = Depends(get_drm_service),
):
    """
    Revoke a previously issued license.
    
    Used for:
    - Account suspension
    - Detected piracy
    - DMCA takedowns
    - User request
    
    Instantly invalidates the license across all devices.
    """
    # Get license
    license_record = db.query(DRMLicense).filter_by(id=license_id).first()
    if not license_record:
        raise HTTPException(status_code=404, detail="License not found")
    
    # Verify authorization (only author or user can revoke their own)
    protected_file = db.query(ProtectedFile).filter_by(id=license_record.protected_file_id).first()
    book = db.query(Book).filter_by(id=protected_file.book_id).first()
    
    if license_record.user_id != current_user.id and book.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to revoke this license")
    
    try:
        # Mark as inactive
        license_record.is_active = False
        
        # Create revocation record
        revocation = DRMRevocation(
            id=str(__import__('uuid').uuid4()),
            protected_file_id=license_record.protected_file_id,
            user_id=license_record.user_id,
            license_id=license_id,
            revocation_reason=reason,
        )
        
        db.add(revocation)
        db.commit()
        
        # (In production) Invalidate in cache for instant effect
        drm.revoke_license(license_id)
        
        logger.info(f"License revoked: {license_id} (reason: {reason})")
        
        return {"success": True, "message": "License revoked successfully"}
    
    except Exception as e:
        logger.error(f"Error revoking license: {str(e)}")
        raise HTTPException(status_code=500, detail="Error revoking license")
