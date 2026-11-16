from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings
from app.core.logging import configure_logging

settings = get_settings()
configure_logging(settings.log_level, settings.log_format)

celery_app = Celery(
    "omoluabi",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.worker.tasks.system",
        "app.worker.tasks.content",
        "app.worker.tasks.rights",
        "app.worker.tasks.scripts",
        "app.worker.tasks.voice",
        "app.worker.tasks.video",
        "app.worker.tasks.publishing",
        "app.worker.tasks.analytics",
    ],
)
celery_app.conf.update(
    task_acks_late=True,  # a crashed worker does not lose the job
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,  # long media jobs: one at a time per process
    task_track_started=True,
    task_time_limit=60 * 60,
    task_soft_time_limit=55 * 60,
    result_expires=60 * 60 * 24,
    timezone="Africa/Lagos",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    beat_schedule={
        # 06:10 Lagos time daily (run by the `beat` service).
        "rights-expiry-sweep": {
            "task": "rights.expiry_sweep",
            "schedule": crontab(hour=6, minute=10),
        },
        # Uploads that are due (every 5 minutes) and automatic scheduling (hourly, only
        # after the unlock). Both do nothing while publishing is paused.
        "publishing-dispatch": {"task": "publishing.dispatch", "schedule": crontab(minute="*/5")},
        "system-heartbeat": {"task": "system.heartbeat", "schedule": crontab(minute="*/5")},
        "system-monitor": {"task": "system.monitor", "schedule": crontab(minute="*/15")},
        "analytics-youtube-sync": {
            "task": "analytics.youtube_sync",
            "schedule": crontab(hour=9, minute=20),  # after YouTube's daily data refresh
        },
        "publishing-auto-schedule": {
            "task": "publishing.auto_schedule",
            "schedule": crontab(minute=7),
        },
    },
)
