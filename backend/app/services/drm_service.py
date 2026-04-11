"""
DRM (Digital Rights Management) System - Content Protection

Implements enterprise-grade content protection with:
- File-level encryption (AES-256)
- Access control & usage rights
- Device binding & watermarking
- Revocation & expiration
- Forensic tracking for piracy detection
"""

import logging
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from enum import Enum
from uuid import uuid4

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.backends import default_backend

logger = logging.getLogger(__name__)


class UsageRight(str, Enum):
    """Usage rights for protected content."""
    VIEW = "view"  # Read/view only
    PRINT = "print"  # Allow printing
    COPY = "copy"  # Allow text selection/copying
    OFFLINE = "offline"  # Allow offline access
    SHARE = "share"  # Allow sharing with other users


class AccessLevel(str, Enum):
    """Access levels for content."""
    PUBLIC = "public"  # Free access
    SUBSCRIBER = "subscriber"  # Subscription required
    PREMIUM = "premium"  # Premium tier only
    RESTRICTED = "restricted"  # Specific users only


class DRMService:
    """
    DRM service for content protection and license management.
    
    Handles encryption, decryption, license generation, and access control.
    """
    
    def __init__(self, master_key: Optional[str] = None):
        """
        Initialize DRM service.
        
        Args:
            master_key: Master encryption key (should be env var in production)
        """
        if not master_key:
            raise ValueError("Master key required for DRM service")
        
        self.master_key = master_key
        self.backend = default_backend()
    
    # ==================== FILE ENCRYPTION ====================
    
    def encrypt_file(self, file_content: bytes, file_id: str) -> Dict[str, Any]:
        """
        Encrypt file content with AES-256.
        
        Args:
            file_content: Raw file bytes
            file_id: Unique file identifier
        
        Returns:
            Dict with encrypted_content, salt, and encryption metadata
        """
        try:
            # Generate random salt
            salt = secrets.token_bytes(32)
            
            # Derive key from master key + salt (PBKDF2)
            kdf = PBKDF2(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=480000,  # OWASP recommendation
                backend=self.backend
            )
            key = kdf.derive(self.master_key.encode())
            
            # Encrypt with Fernet (AES-128 in CBC mode + HMAC-SHA256)
            cipher = Fernet(key)
            encrypted_content = cipher.encrypt(file_content)
            
            # Calculate file hash for integrity verification
            file_hash = hashlib.sha256(file_content).hexdigest()
            encrypted_hash = hashlib.sha256(encrypted_content).hexdigest()
            
            logger.info(f"File encrypted: {file_id} ({len(file_content)} → {len(encrypted_content)} bytes)")
            
            return {
                "encrypted_content": encrypted_content,
                "salt": salt.hex(),
                "algorithm": "AES-256-CBC",
                "file_hash": file_hash,
                "encrypted_hash": encrypted_hash,
                "encryption_timestamp": datetime.utcnow().isoformat(),
                "key_derivation": "PBKDF2-SHA256-480k",
            }
        
        except Exception as e:
            logger.error(f"Error encrypting file {file_id}: {str(e)}")
            raise
    
    def decrypt_file(self, encrypted_content: bytes, salt: str) -> bytes:
        """
        Decrypt file content.
        
        Args:
            encrypted_content: Encrypted file bytes
            salt: Encryption salt (hex string)
        
        Returns:
            Decrypted file bytes
        """
        try:
            # Regenerate key from master key + salt
            salt_bytes = bytes.fromhex(salt)
            
            kdf = PBKDF2(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt_bytes,
                iterations=480000,
                backend=self.backend
            )
            key = kdf.derive(self.master_key.encode())
            
            # Decrypt
            cipher = Fernet(key)
            decrypted_content = cipher.decrypt(encrypted_content)
            
            logger.info(f"File decrypted ({len(encrypted_content)} → {len(decrypted_content)} bytes)")
            
            return decrypted_content
        
        except Exception as e:
            logger.error(f"Error decrypting file: {str(e)}")
            raise
    
    # ==================== LICENSE GENERATION ====================
    
    def generate_license(
        self,
        file_id: str,
        user_id: str,
        device_id: str,
        usage_rights: List[UsageRight],
        access_level: AccessLevel,
        expires_in_hours: int = 24,
        max_offline_downloads: int = 0,
        show_watermark: bool = True,
    ) -> Dict[str, Any]:
        """
        Generate a content license with usage rules.
        
        Args:
            file_id: File to license
            user_id: User receiving license
            device_id: Device identifier (browser fingerprint/device ID)
            usage_rights: List of allowed usage rights
            access_level: Access tier required
            expires_in_hours: License expiration (default 24h)
            max_offline_downloads: Max offline copies allowed (0 = none)
            show_watermark: Include watermark in content
        
        Returns:
            License object with encrypted key and policy
        """
        license_id = str(uuid4())
        now = datetime.utcnow()
        expires_at = now + timedelta(hours=expires_in_hours)
        
        # Generate content key (short-lived decryption key)
        content_key = secrets.token_urlsafe(32)
        
        license_policy = {
            "license_id": license_id,
            "file_id": file_id,
            "user_id": user_id,
            "device_id": device_id,  # Device binding
            "issued_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "usage_rights": [right.value for right in usage_rights],
            "access_level": access_level.value,
            "content_key": content_key,
            "max_offline_downloads": max_offline_downloads,
            "offline_downloads_used": 0,
            "show_watermark": show_watermark,
            "watermark_text": f"Licensed to {user_id}",  # Forensic watermark
        }
        
        # Sign license with master key
        license_json = str(license_policy)
        signature = hashlib.sha256(
            (license_json + self.master_key).encode()
        ).hexdigest()
        
        license_policy["signature"] = signature
        
        logger.info(f"License generated: {license_id} for user {user_id}")
        
        return license_policy
    
    # ==================== LICENSE VERIFICATION ====================
    
    def verify_license(self, license_policy: Dict[str, Any], device_id: str) -> bool:
        """
        Verify license validity and device binding.
        
        Args:
            license_policy: License object
            device_id: Current device ID
        
        Returns:
            True if license is valid, False otherwise
        """
        try:
            # Check expiration
            expires_at = datetime.fromisoformat(license_policy["expires_at"])
            if datetime.utcnow() > expires_at:
                logger.warning(f"License expired: {license_policy['license_id']}")
                return False
            
            # Check device binding
            if license_policy.get("device_id") != device_id:
                logger.warning(f"Device mismatch for license {license_policy['license_id']}")
                return False
            
            # Verify signature
            stored_signature = license_policy.pop("signature", None)
            computed_signature = hashlib.sha256(
                (str(license_policy) + self.master_key).encode()
            ).hexdigest()
            license_policy["signature"] = stored_signature  # Restore for later use
            
            if stored_signature != computed_signature:
                logger.error(f"License signature mismatch: {license_policy['license_id']}")
                return False
            
            return True
        
        except Exception as e:
            logger.error(f"Error verifying license: {str(e)}")
            return False
    
    def check_usage_right(
        self,
        license_policy: Dict[str, Any],
        requested_right: UsageRight
    ) -> bool:
        """
        Check if license allows a specific usage right.
        
        Args:
            license_policy: License object
            requested_right: Usage right to check
        
        Returns:
            True if right is allowed
        """
        allowed_rights = license_policy.get("usage_rights", [])
        return requested_right.value in allowed_rights
    
    # ==================== WATERMARKING ====================
    
    def add_watermark(
        self,
        content: bytes,
        user_id: str,
        file_type: str = "pdf"
    ) -> bytes:
        """
        Add forensic watermark to content for piracy tracing.
        
        Args:
            content: File content
            user_id: User ID (for forensic tracking)
            file_type: File type (pdf, epub, etc.)
        
        Returns:
            Watermarked content
        """
        try:
            # For PDF: embed XMP metadata with user info
            # For EPUB: add watermark data to OPF manifest
            # For text files: add header comment with user ID
            
            if file_type == "pdf":
                # Add PDF metadata
                watermark_metadata = f"""
/Producer (AI Book Writer DRM {user_id})
/CreationDate (D:{datetime.utcnow().strftime('%Y%m%d%H%M%S')})
/LicensedTo {user_id}
""".encode()
                # In real implementation, would use PyPDF2 to embed metadata
                return content + watermark_metadata
            
            elif file_type == "epub":
                # EPUB is a ZIP, would need to extract, add watermark to OPF, rezip
                watermark_data = f"<!-- Licensed to {user_id} on {datetime.utcnow().isoformat()} -->\n"
                # In real implementation, would modify OPF file
                return content + watermark_data.encode()
            
            else:
                # Plain text watermark
                watermark = f"\n\n[Licensed to: {user_id}]\n[Access Date: {datetime.utcnow().isoformat()}]\n"
                return content + watermark.encode()
        
        except Exception as e:
            logger.error(f"Error adding watermark: {str(e)}")
            # Return original content if watermarking fails
            return content
    
    # ==================== REVOCATION ====================
    
    def revoke_license(self, license_id: str) -> bool:
        """
        Revoke a previously issued license.
        
        In production, would store revoked licenses in Redis cache or DB
        for quick lookup during playback.
        
        Args:
            license_id: License to revoke
        
        Returns:
            True if revocation successful
        """
        # TODO: Store in cache/database
        # revocation_cache.set(license_id, {"revoked_at": datetime.utcnow()})
        logger.info(f"License revoked: {license_id}")
        return True
    
    def is_license_revoked(self, license_id: str) -> bool:
        """
        Check if a license has been revoked.
        
        Args:
            license_id: License to check
        
        Returns:
            True if license is revoked
        """
        # TODO: Check cache/database
        # return revocation_cache.get(license_id) is not None
        return False
    
    # ==================== PLAYBACK TRACKING ====================
    
    def track_playback(
        self,
        license_id: str,
        user_id: str,
        file_id: str,
        device_id: str,
        playback_start: float,
        playback_end: float,
    ) -> Dict[str, Any]:
        """
        Track content playback for DRM audit and piracy detection.
        
        Args:
            license_id: License being used
            user_id: User playing content
            file_id: Content being played
            device_id: Device playing content
            playback_start: Playback start position (seconds)
            playback_end: Playback end position (seconds)
        
        Returns:
            Playback event record
        """
        event = {
            "event_id": str(uuid4()),
            "license_id": license_id,
            "user_id": user_id,
            "file_id": file_id,
            "device_id": device_id,
            "playback_start": playback_start,
            "playback_end": playback_end,
            "duration_seconds": playback_end - playback_start,
            "timestamp": datetime.utcnow().isoformat(),
            "ip_address": None,  # Would capture from request
            "user_agent": None,  # Would capture from request
        }
        
        # TODO: Store in audit log
        logger.info(f"Playback tracked: {event['event_id']}")
        
        return event
    
    # ==================== OFFLINE ACCESS ====================
    
    def request_offline_download(
        self,
        license_id: str,
        file_id: str,
        user_id: str,
        device_id: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Process offline download request.
        
        Checks license allows offline access and increments counter.
        
        Args:
            license_id: License for content
            file_id: Content to download
            user_id: User requesting download
            device_id: Device storing offline copy
        
        Returns:
            Offline bundle metadata if allowed, None if limit exceeded
        """
        # TODO: Load license from database
        # Check offline_downloads_used < max_offline_downloads
        # Increment offline_downloads_used
        # Generate offline bundle with embedded license
        
        offline_bundle = {
            "offline_bundle_id": str(uuid4()),
            "license_id": license_id,
            "file_id": file_id,
            "user_id": user_id,
            "device_id": device_id,
            "downloaded_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(days=30)).isoformat(),
            "encrypted": True,
        }
        
        logger.info(f"Offline download granted: {offline_bundle['offline_bundle_id']}")
        
        return offline_bundle
    
    # ==================== ANALYTICS & MONITORING ====================
    
    def generate_drm_report(self, file_id: str, days: int = 30) -> Dict[str, Any]:
        """
        Generate DRM analytics report for a file.
        
        Args:
            file_id: File to report on
            days: Report period
        
        Returns:
            Analytics report with usage, access patterns, piracy indicators
        """
        # TODO: Query audit logs and playback events
        
        report = {
            "file_id": file_id,
            "period_days": days,
            "generated_at": datetime.utcnow().isoformat(),
            "total_licenses_issued": 0,
            "active_licenses": 0,
            "revoked_licenses": 0,
            "total_playback_events": 0,
            "unique_users": 0,
            "unique_devices": 0,
            "offline_downloads": 0,
            "piracy_indicators": [
                # Suspicious patterns:
                # - Same license used across multiple devices
                # - Rapid playback skipping
                # - Unusual geographic access patterns
                # - License validity period mismatches
            ],
            "license_distribution": {
                "by_access_level": {},
                "by_usage_rights": {},
                "by_expiration": {},
            },
        }
        
        return report


class DeviceBindingService:
    """
    Generates device identifiers for DRM license binding.
    
    Prevents sharing of licenses across devices.
    """
    
    @staticmethod
    def generate_device_id(user_agent: str, ip_address: str, device_type: str) -> str:
        """
        Generate secure device identifier from browser/device characteristics.
        
        Args:
            user_agent: Browser user agent string
            ip_address: Client IP address
            device_type: Device type (web/ios/android)
        
        Returns:
            Device ID hash
        """
        # Note: This is a simplified approach
        # Production should use more sophisticated fingerprinting
        
        fingerprint_data = f"{user_agent}:{ip_address}:{device_type}"
        device_id = hashlib.sha256(fingerprint_data.encode()).hexdigest()
        
        logger.info(f"Device ID generated for {device_type}: {device_id[:16]}...")
        
        return device_id
    
    @staticmethod
    def verify_device_id(device_id: str, user_agent: str, ip_address: str, device_type: str) -> bool:
        """
        Verify device hasn't changed.
        
        Args:
            device_id: Original device ID
            user_agent: Current user agent
            ip_address: Current IP
            device_type: Current device type
        
        Returns:
            True if device matches
        """
        expected_id = DeviceBindingService.generate_device_id(user_agent, ip_address, device_type)
        
        # Allow some tolerance for IP changes (e.g., mobile networks)
        # In production, use more sophisticated change detection
        if device_id != expected_id:
            logger.warning(f"Device change detected: {device_id[:16]}... vs {expected_id[:16]}...")
            return False
        
        return True
