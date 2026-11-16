"""Daily analytics import from YouTube Analytics (free; skipped in test mode)."""

from __future__ import annotations

from app.core.config import ProviderMode, get_settings
from app.db import session as db_session
from app.services import analytics
from app.worker.celery_app import celery_app


@celery_app.task(name="analytics.youtube_sync", max_retries=0)
def youtube_sync() -> dict:
    settings = get_settings()
    if settings.provider_mode == ProviderMode.SAMPLE:
        return {"skipped": "test mode: no platform figures are imported or invented"}
    from app.adapters.analytics import YouTubeAnalytics

    with db_session.get_sessionmaker()() as db:
        result = analytics.sync_youtube(db, settings, YouTubeAnalytics())
        db.commit()
    return result
