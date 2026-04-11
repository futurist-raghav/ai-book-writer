"""
Payout workflow Celery tasks.

Handles automatic payout processing, email notifications,
and user communications for earnings and subscription events.
"""

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session

from celery import shared_task
from app.db import SessionLocal
from app.models.monetization import MarketplaceRoyalty, AuthorSubscription
from app.models.user import User
from app.services.monetization import RoyaltyService, SubscriptionService
from app.services.email_notification_service import EmailNotificationService
from app.workers.notification_tasks import send_push_notification

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_payout_trigger(self, royalty_id: str):
    """
    Process payout when earnings reach threshold.
    
    Triggered when:
    - Earnings reach $500 milestone
    - Manual payout request
    - Scheduled monthly payout
    
    Args:
        royalty_id: ID of MarketplaceRoyalty record
    """
    db = SessionLocal()
    try:
        royalty = db.query(MarketplaceRoyalty).filter(
            MarketplaceRoyalty.id == royalty_id
        ).first()
        
        if not royalty:
            logger.error(f"Royalty {royalty_id} not found")
            return None
        
        user = royalty.user
        if not user:
            logger.error(f"User not found for royalty {royalty_id}")
            return None
        
        # Check if payout already pending
        if royalty.payouts_pending_cents > 0:
            logger.info(f"Payout already pending for royalty {royalty_id}")
            return None
        
        # Verify earnings are above threshold and not already paid
        available_earnings = (royalty.author_earnings_cents - royalty.payouts_paid_cents 
                             - royalty.payouts_pending_cents)
        
        if available_earnings < 50000:  # $500 minimum
            logger.info(f"Insufficient earnings for payout: ${available_earnings/100:.2f}")
            return None
        
        # Mark payout as pending
        royalty.payouts_pending_cents = available_earnings
        royalty.next_payout_at = datetime.utcnow() + timedelta(days=5)
        db.commit()
        
        # Send payout initiated email
        try:
            email_service = EmailNotificationService()
            email_service.send_payout_initiated(
                user_email=user.email,
                user_name=user.name,
                amount_cents=available_earnings,
                book_title=royalty.book.title if royalty.book else "Your Books",
                payout_date=(datetime.utcnow() + timedelta(days=5)).strftime("%Y-%m-%d"),
            )
        except Exception as e:
            logger.error(f"Error sending payout initiated email: {str(e)}")
        
        # Send push notification
        try:
            send_push_notification.delay(
                user_id=user.id,
                title="Payout Initiated",
                body=f"Payout of ${available_earnings/100:.2f} initiated. Expected in 5 days.",
                notification_type="payout_initiated",
            )
        except Exception as e:
            logger.error(f"Error sending push notification: {str(e)}")
        
        logger.info(f"Payout initiated for user {user.id}: ${available_earnings/100:.2f}")
        return {
            "royalty_id": royalty_id,
            "amount_cents": available_earnings,
            "status": "pending",
        }
        
    except Exception as exc:
        logger.error(f"Error processing payout trigger: {str(exc)}")
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def complete_payout(self, royalty_id: str, transaction_id: str = None):
    """
    Mark payout as completed.
    
    Called when:
    - Bank transfer completes (via webhook)
    - Manual confirmation by admin
    - Automated clearing house (ACH) confirmation
    
    Args:
        royalty_id: ID of MarketplaceRoyalty record
        transaction_id: Bank transaction/reference ID
    """
    db = SessionLocal()
    try:
        royalty = db.query(MarketplaceRoyalty).filter(
            MarketplaceRoyalty.id == royalty_id
        ).first()
        
        if not royalty:
            logger.error(f"Royalty {royalty_id} not found")
            return None
        
        user = royalty.user
        if not user:
            logger.error(f"User not found for royalty {royalty_id}")
            return None
        
        # Finalize payout
        payout_amount = royalty.payouts_pending_cents
        if payout_amount == 0:
            logger.warning(f"No pending payout for royalty {royalty_id}")
            return None
        
        royalty.payouts_paid_cents += payout_amount
        royalty.payouts_pending_cents = 0
        royalty.last_payout_at = datetime.utcnow()
        royalty.next_payout_at = None  # Clear next payout date
        
        if transaction_id:
            royalty.payout_reference = transaction_id
        
        db.commit()
        
        # Send payout completed email
        try:
            email_service = EmailNotificationService()
            email_service.send_payout_completed(
                user_email=user.email,
                user_name=user.name,
                amount_cents=payout_amount,
                book_title=royalty.book.title if royalty.book else "Your Books",
                transaction_id=transaction_id or "---",
                expected_arrival="1-3 business days",
            )
        except Exception as e:
            logger.error(f"Error sending payout completed email: {str(e)}")
        
        # Send push notification
        try:
            send_push_notification.delay(
                user_id=user.id,
                title="Payout Completed",
                body=f"Payout of ${payout_amount/100:.2f} completed. Check your account.",
                notification_type="payout_completed",
            )
        except Exception as e:
            logger.error(f"Error sending push notification: {str(e)}")
        
        logger.info(f"Payout completed for user {user.id}: ${payout_amount/100:.2f}")
        return {
            "royalty_id": royalty_id,
            "amount_cents": payout_amount,
            "transaction_id": transaction_id,
            "status": "completed",
        }
        
    except Exception as exc:
        logger.error(f"Error completing payout: {str(exc)}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def handle_payout_failure(self, royalty_id: str, error_reason: str):
    """
    Handle payout failure (failed bank transfer, invalid account, etc).
    
    Args:
        royalty_id: ID of MarketplaceRoyalty record
        error_reason: Human-readable error message
    """
    db = SessionLocal()
    try:
        royalty = db.query(MarketplaceRoyalty).filter(
            MarketplaceRoyalty.id == royalty_id
        ).first()
        
        if not royalty:
            logger.error(f"Royalty {royalty_id} not found")
            return None
        
        user = royalty.user
        if not user:
            logger.error(f"User not found for royalty {royalty_id}")
            return None
        
        # Revert pending status for retry
        payout_amount = royalty.payouts_pending_cents
        if payout_amount > 0:
            royalty.payouts_pending_cents = 0
            # Retry payout in 3 days
            royalty.next_payout_at = datetime.utcnow() + timedelta(days=3)
        
        db.commit()
        
        # Send payout failed email
        try:
            email_service = EmailNotificationService()
            email_service.send_payout_failed(
                user_email=user.email,
                user_name=user.name,
                amount_cents=payout_amount,
                failure_reason=error_reason,
                retry_date=(datetime.utcnow() + timedelta(days=3)).strftime("%Y-%m-%d"),
            )
        except Exception as e:
            logger.error(f"Error sending payout failed email: {str(e)}")
        
        logger.error(f"Payout failed for user {user.id}: {error_reason}")
        return {
            "royalty_id": royalty_id,
            "amount_cents": payout_amount,
            "error_reason": error_reason,
            "status": "failed",
        }
        
    except Exception as exc:
        logger.error(f"Error handling payout failure: {str(exc)}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task(bind=True, max_retries=2, default_retry_delay=120)
def process_tier_upgrade(self, subscription_id: str, new_tier: str):
    """
    Process subscription tier upgrade.
    
    Handles:
    - Feature limit updates
    - Billing adjustments
    - Pro-rata refunds/charges
    - Email notifications
    
    Args:
        subscription_id: ID of AuthorSubscription record
        new_tier: New tier to upgrade to (pro, studio, publisher)
    """
    db = SessionLocal()
    try:
        subscription = db.query(AuthorSubscription).filter(
            AuthorSubscription.id == subscription_id
        ).first()
        
        if not subscription:
            logger.error(f"Subscription {subscription_id} not found")
            return None
        
        user = subscription.user
        if not user:
            logger.error(f"User not found for subscription {subscription_id}")
            return None
        
        old_tier = subscription.tier
        
        # Get tier features
        tier_features = SubscriptionService.TIER_FEATURES.get(new_tier)
        if not tier_features:
            logger.error(f"Unknown tier: {new_tier}")
            return None
        
        # Update subscription
        subscription.tier = new_tier
        subscription.status = "active"
        subscription.renewed_at = datetime.utcnow()
        
        # Update feature limits
        for key, val in tier_features.items():
            if hasattr(subscription, key):
                setattr(subscription, key, val)
        
        # Calculate billing adjustment (pro-rata)
        if subscription.next_billing_date:
            days_remaining = (subscription.next_billing_date - datetime.utcnow()).days
            if days_remaining > 0:
                # Pro-rata charge/credit for upgrade
                pass  # Stripe handles this
        
        db.commit()
        
        # Send tier upgrade email
        try:
            email_service = EmailNotificationService()
            email_service.send_tier_upgraded(
                user_email=user.email,
                user_name=user.name,
                old_tier=old_tier,
                new_tier=new_tier,
                new_features=list(tier_features.keys()),
                upgrade_date=datetime.utcnow().strftime("%Y-%m-%d"),
            )
        except Exception as e:
            logger.error(f"Error sending tier upgrade email: {str(e)}")
        
        # Send push notification
        try:
            send_push_notification.delay(
                user_id=user.id,
                title="Tier Upgraded",
                body=f"Welcome to {new_tier.upper()}! Enjoy new features.",
                notification_type="tier_upgraded",
            )
        except Exception as e:
            logger.error(f"Error sending push notification: {str(e)}")
        
        logger.info(f"Tier upgraded for user {user.id}: {old_tier} → {new_tier}")
        return {
            "subscription_id": subscription_id,
            "old_tier": old_tier,
            "new_tier": new_tier,
            "status": "upgraded",
        }
        
    except Exception as exc:
        logger.error(f"Error processing tier upgrade: {str(exc)}")
        raise self.retry(exc=exc, countdown=120 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task(bind=True, max_retries=2, default_retry_delay=120)
def process_tier_downgrade(self, subscription_id: str, new_tier: str):
    """
    Process subscription tier downgrade.
    
    Args:
        subscription_id: ID of AuthorSubscription record
        new_tier: New tier to downgrade to
    """
    db = SessionLocal()
    try:
        subscription = db.query(AuthorSubscription).filter(
            AuthorSubscription.id == subscription_id
        ).first()
        
        if not subscription:
            logger.error(f"Subscription {subscription_id} not found")
            return None
        
        user = subscription.user
        if not user:
            logger.error(f"User not found for subscription {subscription_id}")
            return None
        
        old_tier = subscription.tier
        
        # Validate downgrade is allowed
        tier_order = ["free", "pro", "studio", "publisher"]
        if tier_order.index(new_tier) >= tier_order.index(old_tier):
            logger.warning(f"Invalid downgrade: {old_tier} → {new_tier}")
            return None
        
        # Get tier features
        tier_features = SubscriptionService.TIER_FEATURES.get(new_tier)
        if not tier_features:
            logger.error(f"Unknown tier: {new_tier}")
            return None
        
        # Update subscription
        subscription.tier = new_tier
        subscription.renewed_at = datetime.utcnow()
        
        # Update feature limits (may cause data loss if over limit)
        for key, val in tier_features.items():
            if hasattr(subscription, key):
                setattr(subscription, key, val)
        
        db.commit()
        
        logger.info(f"Tier downgraded for user {user.id}: {old_tier} → {new_tier}")
        return {
            "subscription_id": subscription_id,
            "old_tier": old_tier,
            "new_tier": new_tier,
            "status": "downgraded",
        }
        
    except Exception as exc:
        logger.error(f"Error processing tier downgrade: {str(exc)}")
        raise self.retry(exc=exc, countdown=120 * (2 ** self.request.retries))
    finally:
        db.close()


@shared_task(name="process_pending_payouts")
def process_pending_payouts():
    """
    Periodic task to process payouts due today.
    
    Scheduled daily via Celery Beat.
    Checks for royalties with next_payout_at = today and processes them.
    """
    db = SessionLocal()
    try:
        today = datetime.utcnow().date()
        
        # Find royalties due for payout
        due_payouts = db.query(MarketplaceRoyalty).filter(
            MarketplaceRoyalty.next_payout_at != None,
            MarketplaceRoyalty.next_payout_at <= datetime.combine(today, datetime.min.time()),
            MarketplaceRoyalty.payouts_pending_cents == 0,
        ).all()
        
        logger.info(f"Found {len(due_payouts)} payouts due today")
        
        for royalty in due_payouts:
            try:
                process_payout_trigger.delay(royalty.id)
            except Exception as e:
                logger.error(f"Error queuing payout for {royalty.id}: {str(e)}")
        
        return {
            "payouts_processed": len(due_payouts),
            "timestamp": datetime.utcnow().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"Error in process_pending_payouts: {str(e)}")
        return {"error": str(e), "payouts_processed": 0}
    finally:
        db.close()


@shared_task(name="send_earnings_milestones")
def send_earnings_milestones():
    """
    Periodic task to notify users of earnings milestones.
    
    Scheduled weekly via Celery Beat.
    Checks for users reaching $100, $500, $1000 milestones.
    """
    db = SessionLocal()
    try:
        # Find users near milestones
        milestones = [100_00, 500_00, 1000_00]  # In cents
        
        notifications_sent = 0
        
        for milestone in milestones:
            royalties = db.query(MarketplaceRoyalty).filter(
                MarketplaceRoyalty.author_earnings_cents >= milestone,
                MarketplaceRoyalty.author_earnings_cents < milestone + 10_00,  # Window of $10
            ).all()
            
            for royalty in royalties:
                user = royalty.user
                if not user:
                    continue
                
                try:
                    email_service = EmailNotificationService()
                    email_service.send_earnings_milestone(
                        user_email=user.email,
                        user_name=user.name,
                        milestone_amount_cents=milestone,
                        current_earnings_cents=royalty.author_earnings_cents,
                        book_title=royalty.book.title if royalty.book else "Your Books",
                    )
                    
                    send_push_notification.delay(
                        user_id=user.id,
                        title=f"Milestone Reached! 🎉",
                        body=f"You've earned ${milestone/100:.0f}!",
                        notification_type="earnings_milestone",
                    )
                    
                    notifications_sent += 1
                except Exception as e:
                    logger.error(f"Error sending milestone notification for {royalty.id}: {str(e)}")
        
        logger.info(f"Sent {notifications_sent} milestone notifications")
        return {
            "notifications_sent": notifications_sent,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"Error in send_earnings_milestones: {str(e)}")
        return {"error": str(e), "notifications_sent": 0}
    finally:
        db.close()
