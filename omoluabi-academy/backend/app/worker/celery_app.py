from __future__ import annotations

from celery import Celery

from app.core.config import get_settings
from app.core.logging import configure_logging

settings = get_settings()
configure_logging(settings.log_level, settings.log_format)

celery_app = Celery(
    "omoluabi",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.worker.tasks.system"],
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
)
