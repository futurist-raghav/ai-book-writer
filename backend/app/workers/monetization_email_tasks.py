"""
Celery tasks for monetization email notifications.

Handles async sending of:
- Payout confirmation emails
- Tier upgrade notifications
- Earnings milestone emails
- Period earnings summaries
"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional

from celery import shared_task
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user_model import User
from app.services.email_notification_service import EmailNotificationService

logger = logging.getLogger(__name__)

# Initialize email service (can be configured from env)
email_service = EmailNotificationService(
    smtp_server="localhost",  # Configure from environment
    smtp_port=587,
    from_email="noreply@aiebookwriter.com",
)


@shared_task(bind=True, max_retries=3)
def send_payout_initiated_email(
    self,
    user_id: str,
    payout_amount: float,
    payout_date: str,
    destination: str,
) -> dict:
    """
    Send payout initiated confirmation email.
    
    Args:
        user_id: User ID
        payout_amount: Amount being paid out
        payout_date: Date payout will be processed
        destination: Where the payout is going (e.g., "Stripe account")
    """
    db = SessionLocal()
    
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.warning(f"User not found: {user_id}")
            return {"success": False, "message": "User not found"}
        
        payout_dt = datetime.fromisoformat(payout_date)
        success = email_service.send_payout_initiated(
            user,
            Decimal(str(payout_amount)),
            payout_dt,
            destination,
        )
        
        if success:
            logger.info(f"Payout initiated email sent to {user.email}")
        
        return {"success": success, "user_id": user_id}
        
    except Exception as exc:
        logger.error(f"Failed to send payout initiated email: {str(exc)}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task(bind=True, max_retries=3)
def send_payout_completed_email(
    self,
    user_id: str,
    payout_amount: float,
    completion_date: str,
    destination: str,
    confirmation_id: str,
) -> dict:
    """Send payout completed confirmation email."""
    db = SessionLocal()
    
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.warning(f"User not found: {user_id}")
            return {"success": False, "message": "User not found"}
        
        completion_dt = datetime.fromisoformat(completion_date)
        success = email_service.send_payout_completed(
            user,
            Decimal(str(payout_amount)),
            completion_dt,
            destination,
            confirmation_id,
        )
        
        if success:
            logger.info(f"Payout completed email sent to {user.email}")
        
        return {"success": success, "user_id": user_id}
        
    except Exception as exc:
        logger.error(f"Failed to send payout completed email: {str(exc)}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task(bind=True, max_retries=3)
def send_payout_failed_email(
    self,
    user_id: str,
    payout_amount: float,
    reason: str,
) -> dict:
    """Send payout failed notification email."""
    db = SessionLocal()
    
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.warning(f"User not found: {user_id}")
            return {"success": False, "message": "User not found"}
        
        success = email_service.send_payout_failed(
            user,
            Decimal(str(payout_amount)),
            reason,
        )
        
        if success:
            logger.info(f"Payout failed email sent to {user.email}")
        
        return {"success": success, "user_id": user_id}
        
    except Exception as exc:
        logger.error(f"Failed to send payout failed email: {str(exc)}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task(bind=True, max_retries=3)
def send_tier_upgraded_email(
    self,
    user_id: str,
    new_tier: str,
    tier_benefits: list,
    effective_date: str,
) -> dict:
    """Send tier upgrade notification email."""
    db = SessionLocal()
    
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.warning(f"User not found: {user_id}")
            return {"success": False, "message": "User not found"}
        
        effective_dt = datetime.fromisoformat(effective_date)
        success = email_service.send_tier_upgraded(
            user,
            new_tier,
            tier_benefits,
            effective_dt,
        )
        
        if success:
            logger.info(f"Tier upgraded email sent to {user.email}")
        
        return {"success": success, "user_id": user_id, "new_tier": new_tier}
        
    except Exception as exc:
        logger.error(f"Failed to send tier upgraded email: {str(exc)}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task(bind=True, max_retries=3)
def send_earnings_milestone_email(
    self,
    user_id: str,
    total_earnings: float,
    milestone: float,
) -> dict:
    """Send earnings milestone celebration email."""
    db = SessionLocal()
    
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.warning(f"User not found: {user_id}")
            return {"success": False, "message": "User not found"}
        
        success = email_service.send_earnings_milestone(
            user,
            Decimal(str(total_earnings)),
            Decimal(str(milestone)),
        )
        
        if success:
            logger.info(f"Earnings milestone email sent to {user.email}")
        
        return {"success": success, "user_id": user_id, "milestone": milestone}
        
    except Exception as exc:
        logger.error(f"Failed to send earnings milestone email: {str(exc)}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task(bind=True, max_retries=3)
def send_earnings_summary_email(
    self,
    user_id: str,
    period: str,
    earnings: float,
    sales_count: int,
    top_book: Optional[str] = None,
) -> dict:
    """
    Send periodic earnings summary email.
    
    Args:
        user_id: User ID
        period: "monthly", "quarterly", or "annual"
        earnings: Total earnings in period
        sales_count: Number of sales in period
        top_book: (Optional) Title of top performing book
    """
    db = SessionLocal()
    
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.warning(f"User not found: {user_id}")
            return {"success": False, "message": "User not found"}
        
        success = email_service.send_earnings_summary(
            user,
            period,
            Decimal(str(earnings)),
            sales_count,
            top_book,
        )
        
        if success:
            logger.info(f"Earnings summary email ({period}) sent to {user.email}")
        
        return {
            "success": success,
            "user_id": user_id,
            "period": period,
            "earnings": earnings,
        }
        
    except Exception as exc:
        logger.error(f"Failed to send earnings summary email: {str(exc)}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task(name="send_all_earnings_summaries")
def send_all_earnings_summaries(period: str) -> dict:
    """
    Send earnings summary to all active authors.
    
    Periodic task called monthly/quarterly/annually.
    """
    db = SessionLocal()
    
    try:
        # Get all active users
        users = db.query(User).filter(
            User.is_active == True,
            User.has_earned_anything == True,  # Only users with earnings
        ).all()
        
        results = {
            "total": len(users),
            "sent": 0,
            "failed": 0,
        }
        
        for user in users:
            try:
                # TODO: Calculate earnings for period from database
                # This is a stub - actual implementation depends on earnings schema
                earnings = 0.0
                sales_count = 0
                
                success = email_service.send_earnings_summary(
                    user,
                    period,
                    Decimal(str(earnings)),
                    sales_count,
                )
                
                if success:
                    results["sent"] += 1
                else:
                    results["failed"] += 1
                    
            except Exception as e:
                logger.error(f"Failed to send summary to {user.email}: {str(e)}")
                results["failed"] += 1
        
        logger.info(f"Earnings summary email campaign ({period}): {results}")
        return results
        
    except Exception as e:
        logger.error(f"Failed to send earnings summaries: {str(e)}")
        return {"success": False, "error": str(e)}
    finally:
        db.close()
