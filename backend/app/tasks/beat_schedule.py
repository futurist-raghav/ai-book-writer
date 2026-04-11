"""
Celery Beat Schedule Configuration

Defines periodic tasks that run on a schedule via Celery Beat.
"""

from celery.schedules import crontab
from datetime import timedelta


# Celery Beat schedule
beat_schedule = {
    # OAuth token refresh - every 6 hours
    "refresh-expiring-oauth-tokens": {
        "task": "app.workers.oauth_refresh_tasks.refresh_expiring_oauth_tokens",
        "schedule": timedelta(hours=6),
        "options": {"queue": "background"},
    },
    
    # OAuth token validation - daily at 2 AM UTC
    "validate-active-integrations": {
        "task": "app.workers.oauth_refresh_tasks.validate_active_integrations",
        "schedule": crontab(hour=2, minute=0),
        "options": {"queue": "background"},
    },
    
    # Process pending payouts - daily at 9 AM UTC
    "process-pending-payouts": {
        "task": "app.workers.payout_workflow_tasks.process_pending_payouts",
        "schedule": crontab(hour=9, minute=0),
        "options": {"queue": "monetization"},
    },
    
    # Send earnings milestone notifications - weekly on Mondays at 10 AM UTC
    "send-earnings-milestones": {
        "task": "app.workers.payout_workflow_tasks.send_earnings_milestones",
        "schedule": crontab(day_of_week=1, hour=10, minute=0),
        "options": {"queue": "monetization"},
    },
    
    # Send earnings summary reports - monthly on 1st at 8 AM UTC
    "send-earnings-summaries": {
        "task": "app.workers.monetization_email_tasks.send_all_earnings_summaries",
        "schedule": crontab(day_of_month=1, hour=8, minute=0),
        "options": {"queue": "email"},
    },
    
    # Cleanup inactive device tokens - weekly on Sundays at 1 AM UTC
    "cleanup-inactive-device-tokens": {
        "task": "app.workers.notification_tasks.cleanup_inactive_devices",
        "schedule": crontab(day_of_week=6, hour=1, minute=0),
        "options": {"queue": "background"},
    },
}
