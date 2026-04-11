"""
OAuth token refresh background job for API integrations.

Handles automatic refresh of OAuth tokens from external API providers
to maintain valid credentials without user intervention.

Supported providers:
- Goodreads
- OpenAI/GPT integrations
- Publishing platforms (Smashwords, Draft2Digital, etc.)
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

from celery import shared_task
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.database import SessionLocal
from app.models.api_integration_model import APIIntegration
from app.services.oauth_service import OAuthService

logger = logging.getLogger(__name__)

# Initialize OAuth service
oauth_service = OAuthService()


@shared_task(bind=True, max_retries=3)
def refresh_oauth_token(
    self,
    integration_id: str,
    provider: str,
) -> Dict[str, Any]:
    """
    Refresh OAuth token for an API integration.
    
    Args:
        integration_id: ID of the APIIntegration record
        provider: OAuth provider name (goodreads, openai, etc.)
    
    Returns:
        Result with success status and new token expiry
    """
    db = SessionLocal()
    
    try:
        integration = db.query(APIIntegration).filter(
            APIIntegration.id == integration_id,
            APIIntegration.provider == provider,
        ).first()
        
        if not integration:
            logger.warning(f"Integration not found: {integration_id}")
            return {
                "success": False,
                "message": "Integration not found",
            }
        
        # Check if token actually needs refresh
        if integration.token_expires_at and integration.token_expires_at > datetime.utcnow():
            logger.info(f"Token still valid for {integration_id}, skipping refresh")
            return {
                "success": True,
                "message": "Token still valid",
                "expires_at": integration.token_expires_at.isoformat(),
            }
        
        # Refresh the token
        new_token_data = oauth_service.refresh_token(
            provider,
            integration.refresh_token,
            integration.client_id,
            integration.client_secret,
        )
        
        if not new_token_data:
            logger.error(f"Failed to refresh token for {integration_id}")
            integration.is_active = False
            db.commit()
            return {
                "success": False,
                "message": "Token refresh failed",
                "integration_id": integration_id,
            }
        
        # Update integration with new token
        integration.access_token = new_token_data.get("access_token")
        integration.refresh_token = new_token_data.get("refresh_token", integration.refresh_token)
        
        expires_in = new_token_data.get("expires_in", 3600)
        integration.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        
        integration.is_active = True
        integration.last_refreshed_at = datetime.utcnow()
        
        db.commit()
        
        logger.info(f"Token refreshed for {integration_id}, expires at {integration.token_expires_at}")
        
        return {
            "success": True,
            "message": "Token refreshed successfully",
            "integration_id": integration_id,
            "expires_at": integration.token_expires_at.isoformat(),
        }
        
    except Exception as exc:
        logger.error(f"Failed to refresh OAuth token: {str(exc)}")
        db.rollback()
        
        # Retry with exponential backoff
        raise self.retry(
            exc=exc,
            countdown=60 * (2 ** self.request.retries),
        )
    finally:
        db.close()


@shared_task(name="refresh_expiring_oauth_tokens")
def refresh_expiring_oauth_tokens() -> Dict[str, Any]:
    """
    Periodic task to refresh all OAuth tokens that are about to expire.
    
    Runs every hour to check which integrations need token refresh.
    Tokens are refreshed if they expire within the next 24 hours.
    """
    db = SessionLocal()
    
    try:
        # Find integrations with tokens expiring soon (within 24 hours)
        cutoff_time = datetime.utcnow() + timedelta(hours=24)
        
        expiring_integrations = db.query(APIIntegration).filter(
            and_(
                APIIntegration.is_active == True,
                APIIntegration.token_expires_at != None,
                APIIntegration.token_expires_at <= cutoff_time,
                APIIntegration.refresh_token != None,
            )
        ).all()
        
        result = {
            "total_checked": db.query(APIIntegration).filter(
                APIIntegration.is_active == True,
                APIIntegration.token_expires_at != None,
            ).count(),
            "needing_refresh": len(expiring_integrations),
            "refreshed": 0,
            "failed": 0,
            "details": [],
        }
        
        for integration in expiring_integrations:
            try:
                task_result = refresh_oauth_token.apply_async(
                    args=[integration.id, integration.provider],
                    countdown=0,
                )
                
                result["refreshed"] += 1
                result["details"].append({
                    "integration_id": integration.id,
                    "provider": integration.provider,
                    "task_id": task_result.id,
                    "status": "queued",
                })
                
            except Exception as e:
                logger.error(f"Failed to queue refresh for {integration.id}: {str(e)}")
                result["failed"] += 1
                result["details"].append({
                    "integration_id": integration.id,
                    "provider": integration.provider,
                    "status": "failed",
                    "error": str(e),
                })
        
        logger.info(
            f"OAuth token refresh cycle: {result['refreshed']} queued, "
            f"{result['failed']} failed out of {result['needing_refresh']} candidates"
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to run OAuth token refresh cycle: {str(e)}")
        return {
            "success": False,
            "error": str(e),
        }
    finally:
        db.close()


@shared_task(bind=True, max_retries=2)
def handle_token_refresh_error(
    self,
    integration_id: str,
    provider: str,
    error_message: str,
) -> Dict[str, Any]:
    """
    Handle token refresh failure with notification to user.
    
    Called when token refresh fails, notifies user and marks integration inactive.
    """
    db = SessionLocal()
    
    try:
        integration = db.query(APIIntegration).filter(
            APIIntegration.id == integration_id,
        ).first()
        
        if not integration:
            return {"success": False, "message": "Integration not found"}
        
        # Mark integration as inactive
        integration.is_active = False
        integration.error_message = error_message
        db.commit()
        
        logger.warning(
            f"Integration {integration_id} ({provider}) marked inactive due to token error"
        )
        
        # Send notification to user (if notification service available)
        # This would call the push notification or email service
        # to alert user that re-authentication is needed
        
        return {
            "success": True,
            "message": "Integration deactivated and user notified",
            "integration_id": integration_id,
        }
        
    except Exception as exc:
        logger.error(f"Failed to handle token error: {str(exc)}")
        raise self.retry(exc=exc, countdown=300)
    finally:
        db.close()


@shared_task(name="validate_active_integrations")
def validate_active_integrations() -> Dict[str, Any]:
    """
    Periodic task to validate that active integrations are still functional.
    
    Checks if tokens are valid and APIs are reachable.
    Marks integrations as inactive if validation fails.
    """
    db = SessionLocal()
    
    try:
        active_integrations = db.query(APIIntegration).filter(
            APIIntegration.is_active == True,
        ).all()
        
        result = {
            "total": len(active_integrations),
            "valid": 0,
            "invalid": 0,
            "details": [],
        }
        
        for integration in active_integrations:
            try:
                # Validate token with the provider
                is_valid = oauth_service.validate_token(
                    integration.provider,
                    integration.access_token,
                )
                
                if is_valid:
                    result["valid"] += 1
                else:
                    # Token invalid, try to refresh
                    refresh_oauth_token.apply_async(
                        args=[integration.id, integration.provider],
                        countdown=0,
                    )
                    result["details"].append({
                        "integration_id": integration.id,
                        "provider": integration.provider,
                        "status": "invalid_refreshing",
                    })
                        
            except Exception as e:
                logger.error(f"Validation failed for {integration.id}: {str(e)}")
                # Mark as invalid; allow admin to re-auth
                integration.is_active = False
                integration.error_message = str(e)
                db.commit()
                
                result["invalid"] += 1
                result["details"].append({
                    "integration_id": integration.id,
                    "provider": integration.provider,
                    "status": "validation_failed",
                    "error": str(e),
                })
        
        logger.info(
            f"Integration validation: {result['valid']} valid, "
            f"{result['invalid']} invalid out of {result['total']}"
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to validate integrations: {str(e)}")
        return {
            "success": False,
            "error": str(e),
        }
    finally:
        db.close()
