"""
Celery Application Configuration

Sets up Celery for background task processing.
"""

from celery import Celery

from app.core.config import settings
from app.tasks.beat_schedule import beat_schedule

# Create Celery app
celery_app = Celery(
    "ai_book_writer",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max per task
    task_soft_time_limit=3300,  # Soft limit at 55 minutes
    worker_prefetch_multiplier=1,  # One task at a time for long-running tasks
    task_acks_late=True,  # Acknowledge after completion
    task_reject_on_worker_lost=True,  # Retry if worker dies
    beat_schedule=beat_schedule,  # Add beat schedule
)

# Auto-discover tasks from task modules
celery_app.autodiscover_tasks(
    [
        "app.tasks.transcription_tasks",
        "app.tasks.extraction_tasks",
        "app.tasks.export_tasks",
        "app.workers.notification_tasks",
        "app.workers.push_notification_sender",
        "app.workers.monetization_email_tasks",
        "app.workers.oauth_refresh_tasks",
        "app.workers.payout_workflow_tasks",
    ]
)
